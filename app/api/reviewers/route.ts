import { z } from "zod";
import { verifiedAddresses } from "@/lib/live-agreements-access";
import { authorize, database, failure, HttpError } from "@/lib/server";

/**
 * The reviewer pool: people who have said they will review work for a fee.
 *
 * A proof-checked job needs two human reviewers besides the client and the
 * worker, and a milestone job can name one. Finding them was entirely the
 * client's problem. Anyone with an @name can join here, say what they can
 * judge, and be suggested in the job forms. Joining promises nothing on
 * chain: a reviewer still has to be named on a job and accept it.
 */

const proofs = z.array(z.object({ address: z.string(), signature: z.string() })).min(1).max(8);
const joinSchema = z.object({ skills: z.string().trim().min(3).max(160), proofs }).strict();
const leaveSchema = z.object({ proofs }).strict();

type ReviewerRow = { address: string; skills: string; tag: string; display_name: string; updated_at: string };

export async function GET() {
  try {
    const result = await database()
      .prepare(
        "SELECT r.address, r.skills, r.updated_at, t.tag, t.display_name FROM reviewers r" +
        " JOIN tags t ON lower(t.address) = lower(r.address) ORDER BY r.updated_at DESC LIMIT 200",
      )
      .all<ReviewerRow>();
    return Response.json({
      reviewers: result.results.map((r) => ({ address: r.address, tag: r.tag, displayName: r.display_name, skills: r.skills })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

/** Join, or update what you review. Needs an @name so clients can find you. */
export async function PUT(request: Request) {
  try {
    const owner = await authorize(request);
    const body = joinSchema.parse(await request.json());
    const [address] = await verifiedAddresses(body.proofs);
    if (!address) throw new HttpError(403, "A signature from your account is required.");
    const named = await database().prepare("SELECT tag FROM tags WHERE lower(address) = lower(?)").bind(address).first();
    if (!named) throw new HttpError(409, "Claim an @name first, so clients can find and name you.");
    const now = new Date().toISOString();
    await database()
      .prepare(
        "INSERT INTO reviewers (address, owner, skills, created_at, updated_at) VALUES (?, ?, ?, ?, ?)" +
        " ON CONFLICT(address) DO UPDATE SET skills = excluded.skills, updated_at = excluded.updated_at",
      )
      .bind(address, owner, body.skills, now, now)
      .run();
    return Response.json({ address, skills: body.skills });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await authorize(request);
    const body = leaveSchema.parse(await request.json());
    const [address] = await verifiedAddresses(body.proofs);
    if (!address) throw new HttpError(403, "A signature from your account is required.");
    await database().prepare("DELETE FROM reviewers WHERE lower(address) = lower(?)").bind(address).run();
    return Response.json({ left: true });
  } catch (error) {
    return failure(error);
  }
}
