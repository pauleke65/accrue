import { z } from "zod";
import { parseProofsParam, verifiedAddresses, type ParticipantProof } from "@/lib/live-agreements-access";
import { authorize, database, failure, HttpError } from "@/lib/server";

/**
 * Hiring links.
 *
 * Both escrow contracts fix the worker's address when a job is created, so a
 * client could only hire someone whose @name they already knew. An offer is
 * the step before that: the client writes the job, shares a link, and
 * whoever takes it becomes the worker the client then creates the job for.
 * Nothing here moves money or touches the chain; the offer only carries the
 * draft forward so the client does not have to type it twice.
 *
 * Reading an offer by its token is public, like any link someone was sent.
 * Every change is signed by the address it acts for.
 */

type OfferRow = {
  token: string;
  kind: string;
  owner: string;
  client_address: string;
  title: string;
  draft_json: string;
  status: string;
  taker_address: string | null;
  job_id: string | null;
  listed: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

const createSchema = z.object({
  kind: z.enum(["proof", "milestone"]),
  title: z.string().trim().min(3).max(120),
  draft: z.record(z.string(), z.unknown()),
  listed: z.boolean().optional(),
  proofs: z.array(z.object({ address: z.string(), signature: z.string() })).min(1).max(8),
}).strict();

const takeSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{32}$/),
  proofs: z.array(z.object({ address: z.string(), signature: z.string() })).min(1).max(8),
}).strict();

const updateSchema = takeSchema.extend({
  action: z.enum(["created", "withdraw", "reopen"]),
  jobId: z.string().max(80).optional(),
}).strict();

async function tagFor(address: string | null): Promise<string | null> {
  if (!address) return null;
  const row = await database()
    .prepare("SELECT tag FROM tags WHERE lower(address) = lower(?) LIMIT 1")
    .bind(address)
    .first<{ tag: string }>();
  return row?.tag ?? null;
}

async function load(token: string): Promise<OfferRow> {
  const row = await database().prepare("SELECT * FROM job_offers WHERE token = ?").bind(token).first<OfferRow>();
  if (!row) throw new HttpError(404, "This hiring link does not exist.");
  return row;
}

/** The first proven address that matches, or a 403. */
async function provenAs(proofs: ParticipantProof[], match?: (address: string) => boolean) {
  const addresses = await verifiedAddresses(proofs);
  const found = match ? addresses.find(match) : addresses[0];
  if (!found) throw new HttpError(403, "A signature from the right account is required.");
  return found;
}

const expired = (row: OfferRow) => new Date(row.expires_at).getTime() < Date.now();

async function present(row: OfferRow, viewer: "public" | "client" | "taker") {
  const draft = JSON.parse(row.draft_json) as Record<string, unknown>;
  return {
    token: row.token,
    kind: row.kind,
    title: row.title,
    status: expired(row) && row.status === "open" ? "expired" : row.status,
    draft,
    clientAddress: row.client_address,
    clientTag: await tagFor(row.client_address),
    takerAddress: viewer === "public" ? null : row.taker_address,
    takerTag: viewer === "public" ? null : await tagFor(row.taker_address),
    jobId: row.job_id,
    listed: row.listed === 1,
    viewer,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (url.searchParams.get("board") === "1") {
      // The public job board: open links their clients chose to list.
      const result = await database()
        .prepare("SELECT * FROM job_offers WHERE listed = 1 AND status = 'open' AND expires_at > ? ORDER BY created_at DESC LIMIT 100")
        .bind(new Date().toISOString())
        .all<OfferRow>();
      const offers = await Promise.all(result.results.map((row) => present(row, "public")));
      return Response.json({ offers }, { headers: { "Cache-Control": "public, max-age=30" } });
    }
    if (token) {
      if (!/^[a-f0-9]{32}$/.test(token)) throw new HttpError(404, "This hiring link does not exist.");
      return Response.json({ offer: await present(await load(token), "public") });
    }

    // The signed-in person's own offers: ones they wrote, and ones they took.
    await authorize();
    const addresses = await verifiedAddresses(parseProofsParam(url));
    if (!addresses.length) return Response.json({ offers: [] });
    const marks = addresses.map(() => "?").join(",");
    const lower = addresses.map((a) => a.toLowerCase());
    const result = await database()
      .prepare(
        `SELECT * FROM job_offers WHERE (lower(client_address) IN (${marks}) OR lower(taker_address) IN (${marks}))` +
        " AND status IN ('open', 'taken') ORDER BY updated_at DESC LIMIT 50",
      )
      .bind(...lower, ...lower)
      .all<OfferRow>();
    const offers = await Promise.all(result.results.map((row) =>
      present(row, lower.includes(row.client_address.toLowerCase()) ? "client" : "taker")));
    return Response.json({ offers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await authorize(request);
    const body = createSchema.parse(await request.json());
    const client = await provenAs(body.proofs);
    const draft = JSON.stringify(body.draft);
    if (draft.length > 16_000) throw new HttpError(413, "That job description is too long for a hiring link.");
    const token = crypto.randomUUID().replace(/-/g, "");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
    await database()
      .prepare(
        "INSERT INTO job_offers (token, kind, owner, client_address, title, draft_json, status, taker_address, job_id, listed, expires_at, created_at, updated_at)" +
        " VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?, ?, ?, ?)",
      )
      .bind(token, body.kind, owner, client, body.title, draft, body.listed ? 1 : 0, expiresAt, now, now)
      .run();
    return Response.json({ token, expiresAt }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

/** Taking a job: the signer becomes the worker the client will name. */
export async function PUT(request: Request) {
  try {
    await authorize(request);
    const body = takeSchema.parse(await request.json());
    const row = await load(body.token);
    if (row.status !== "open" || expired(row)) throw new HttpError(409, "Someone has already taken this job, or the link has closed.");
    const taker = await provenAs(body.proofs, (a) => a.toLowerCase() !== row.client_address.toLowerCase());
    // Guarded on status so two people taking at once cannot both win.
    const result = await database()
      .prepare("UPDATE job_offers SET status = 'taken', taker_address = ?, updated_at = ? WHERE token = ? AND status = 'open'")
      .bind(taker, new Date().toISOString(), body.token)
      .run();
    if (!result.meta.changes) throw new HttpError(409, "Someone took this job a moment before you.");
    return Response.json({ offer: await present(await load(body.token), "taker") });
  } catch (error) {
    return failure(error);
  }
}

/** Client-only changes: record the created job, withdraw, or reopen. */
export async function PATCH(request: Request) {
  try {
    await authorize(request);
    const body = updateSchema.parse(await request.json());
    const row = await load(body.token);
    await provenAs(body.proofs, (a) => a.toLowerCase() === row.client_address.toLowerCase());
    const now = new Date().toISOString();
    const db = database();
    if (body.action === "created") {
      if (row.status !== "taken" || !body.jobId) throw new HttpError(409, "Only a taken offer can become a job.");
      await db.prepare("UPDATE job_offers SET status = 'created', job_id = ?, updated_at = ? WHERE token = ?").bind(body.jobId, now, body.token).run();
    } else if (body.action === "withdraw") {
      await db.prepare("UPDATE job_offers SET status = 'withdrawn', updated_at = ? WHERE token = ?").bind(now, body.token).run();
    } else {
      // Reopen: the person who took it went quiet, so let someone else.
      await db.prepare("UPDATE job_offers SET status = 'open', taker_address = NULL, updated_at = ? WHERE token = ?").bind(now, body.token).run();
    }
    return Response.json({ offer: await present(await load(body.token), "client") });
  } catch (error) {
    return failure(error);
  }
}
