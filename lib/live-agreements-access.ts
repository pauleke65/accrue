import { verifyMessage, getAddress, isAddress } from "viem";
import { database } from "./server";
import { participantProofMessage } from "./participant-proof";

/**
 * Who can see a funded job's readable terms.
 *
 * The contract decides who can act on an agreement — accept, fund, submit,
 * approve, withdraw — by checking the caller's address against the terms it
 * stored at creation. The readable text behind those terms lived nowhere the
 * contract could enforce the same rule: it was written once, to the account
 * that happened to create the row, and nobody else could ever read it back —
 * not even someone named as the worker or verifier on that exact agreement,
 * signing transactions for it every day.
 *
 * This closes that gap the same way the app already proves control of a tag:
 * a signature over a fixed message, checked against the address it claims to
 * be. An agreement is visible to whoever created it, unchanged, and now also
 * to anyone who can sign as its worker or verifier — because they are not a
 * stranger to an agreement that already names them.
 */

export type LiveAgreementRow = {
  id: string;
  owner: string;
  chain_id: number;
  escrow: string;
  onchain_id: string;
  title: string;
  scope: string;
  payer_address: string;
  worker_address: string;
  verifier_address: string;
  worker_tag: string | null;
  verifier_tag: string | null;
  milestones: string;
  created_at: string;
};

export type ParticipantProof = { address?: string; signature?: string };

/**
 * Checks each proof against the message it should have signed and returns
 * only the addresses that genuinely verify. A malformed or invalid entry is
 * dropped rather than failing the whole request — one bad proof should not
 * hide agreements a valid one would have found.
 */
export async function verifiedAddresses(
  proofs: ParticipantProof[] | undefined,
): Promise<`0x${string}`[]> {
  if (!proofs?.length) return [];
  // A wallet has two roles worth proving here (worker, verifier — the payer
  // already sees everything through ownership); this cap is headroom, not a
  // design target.
  const results = await Promise.all(
    proofs.slice(0, 8).map(async (p) => {
      if (!p.address || !isAddress(p.address) || !p.signature?.startsWith("0x"))
        return null;
      const address = getAddress(p.address);
      try {
        const ok = await verifyMessage({
          address,
          message: participantProofMessage(address),
          signature: p.signature as `0x${string}`,
        });
        return ok ? address : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((a): a is `0x${string}` => a !== null);
}

/**
 * Every agreement this request can legitimately see: the ones its own
 * account created — unchanged, still the common case — plus any where a
 * proven address is named as worker or verifier, regardless of whose account
 * recorded it. Rows are merged by id, so an agreement this account both
 * created and is a participant in is not duplicated.
 */
export async function accessibleLiveAgreements(
  owner: string,
  proofs?: ParticipantProof[],
): Promise<LiveAgreementRow[]> {
  const db = database();
  const own = await db
    .prepare(
      "SELECT * FROM live_agreements WHERE owner = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(owner)
    .all<LiveAgreementRow>();

  const byId = new Map(own.results.map((row) => [row.id, row]));

  const addresses = await verifiedAddresses(proofs);
  if (addresses.length) {
    const placeholders = addresses.map(() => "?").join(",");
    const asParticipant = await db
      .prepare(
        `SELECT * FROM live_agreements` +
          ` WHERE worker_address IN (${placeholders})` +
          ` OR verifier_address IN (${placeholders})` +
          ` ORDER BY created_at DESC LIMIT 50`,
      )
      .bind(...addresses, ...addresses)
      .all<LiveAgreementRow>();
    for (const row of asParticipant.results) byId.set(row.id, row);
  }

  return [...byId.values()].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
  );
}

/**
 * Parses the `proofs` query parameter both read endpoints accept: a JSON
 * array of `{address, signature}`, URL-encoded. Malformed input yields no
 * proofs rather than an error — a read endpoint should degrade to "just my
 * own agreements," not fail outright over one bad parameter.
 */
export function parseProofsParam(url: URL): ParticipantProof[] | undefined {
  const raw = url.searchParams.get("proofs");
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed as ParticipantProof[];
  } catch {
    return undefined;
  }
}
