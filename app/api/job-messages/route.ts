import { z } from "zod";
import { parseProofsParam, verifiedAddresses, type ParticipantProof } from "@/lib/live-agreements-access";
import { authorize, database, failure, HttpError } from "@/lib/server";

/**
 * Messages between the people on one job: the client, the worker and the
 * reviewers. Questions about the brief and notes on a draft belong next to
 * the job, not in a chat app nobody else can check later.
 *
 * Only a proven participant of that exact job can read or post. Messages are
 * conversation, not terms: the contract still enforces only what was hashed
 * and accepted.
 */

const kind = z.enum(["proof", "milestone"]);
const postSchema = z.object({
  kind,
  id: z.string().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
  /** Which of the proven accounts is speaking; the role walkthrough proves three. */
  author: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  proofs: z.array(z.object({ address: z.string(), signature: z.string() })).min(1).max(8),
}).strict();

async function participants(jobKind: "proof" | "milestone", id: string): Promise<string[]> {
  if (jobKind === "proof") {
    const row = await database()
      .prepare("SELECT payer_address, worker_address, verifier_a, verifier_b, verifier_c FROM digital_jobs WHERE id = ?")
      .bind(id)
      .first<Record<string, string>>();
    return row ? Object.values(row) : [];
  }
  const row = await database()
    .prepare("SELECT payer_address, worker_address, verifier_address FROM live_agreements WHERE id = ?")
    .bind(id)
    .first<Record<string, string>>();
  return row ? Object.values(row) : [];
}

/** The caller's proven address on this job (the named one, if given), or a 403. */
async function member(jobKind: "proof" | "milestone", id: string, proofs: ParticipantProof[] | undefined, author?: string) {
  const people = (await participants(jobKind, id)).map((a) => a.toLowerCase());
  if (!people.length) throw new HttpError(404, "Job not found.");
  const mine = (await verifiedAddresses(proofs)).find((a) =>
    people.includes(a.toLowerCase()) && (!author || a.toLowerCase() === author.toLowerCase()));
  if (!mine) throw new HttpError(403, "Only the people on this job can read its messages.");
  return mine;
}

export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const jobKind = kind.parse(url.searchParams.get("kind"));
    const id = z.string().min(1).max(80).parse(url.searchParams.get("id"));
    await member(jobKind, id, parseProofsParam(url));
    const result = await database()
      .prepare(
        "SELECT m.id, m.author_address, m.body, m.created_at, t.tag FROM job_messages m" +
        " LEFT JOIN tags t ON lower(t.address) = lower(m.author_address)" +
        " WHERE m.job_kind = ? AND m.job_id = ? ORDER BY m.created_at ASC LIMIT 200",
      )
      .bind(jobKind, id)
      .all<{ id: string; author_address: string; body: string; created_at: string; tag: string | null }>();
    return Response.json({
      messages: result.results.map((m) => ({ id: m.id, author: m.author_address, tag: m.tag, body: m.body, at: m.created_at })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const body = postSchema.parse(await request.json());
    const author = await member(body.kind, body.id, body.proofs, body.author);
    const id = crypto.randomUUID();
    await database()
      .prepare("INSERT INTO job_messages (id, job_kind, job_id, author_address, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, body.kind, body.id, author, body.body, new Date().toISOString())
      .run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
