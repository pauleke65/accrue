import { database, HttpError } from "./server";

/**
 * Who may see and act on a sandbox agreement.
 *
 * The row still has a creating owner, but named parties are stored separately
 * so a worker or verifier signed in as a different user can load and accept
 * the same agreement.
 */

const TAG = /^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$/;

export function sandboxTag(value: string): string | null {
  const tag = value.trim().toLowerCase().replace(/^@/, "");
  return TAG.test(tag) ? tag : null;
}

export async function ownerForTag(tag: string): Promise<string | null> {
  const row = await database()
    .prepare("SELECT owner FROM tags WHERE tag = ?")
    .bind(tag)
    .first<{ owner: string }>();
  return row?.owner ?? null;
}

/** A party must already have claimed this tag. Free-text names are refused. */
export async function requireRegisteredTag(value: string, role: string) {
  const tag = sandboxTag(value);
  if (!tag)
    throw new HttpError(
      400,
      `${role} must be a claimed @tag (letters, numbers, underscores).`,
    );
  const owner = await ownerForTag(tag);
  if (!owner)
    throw new HttpError(
      400,
      `Nobody on Accrue goes by @${tag} yet. They need to sign in and claim that tag first.`,
    );
  return { tag, owner };
}

export async function addParty(
  agreementId: string,
  owner: string,
  role: string,
) {
  await database()
    .prepare(
      "INSERT INTO agreement_parties(agreement_id, owner, role) VALUES(?,?,?) ON CONFLICT(agreement_id, owner) DO NOTHING",
    )
    .bind(agreementId, owner, role)
    .run();
}

export async function recordSandboxParties(
  agreementId: string,
  creator: string,
  earner: string,
  verifier: string,
) {
  await addParty(agreementId, creator, "payer");
  const worker = await requireRegisteredTag(earner, "The worker");
  await addParty(agreementId, worker.owner, "earner");
  if (verifier.trim()) {
    const reviewer = await requireRegisteredTag(verifier, "The verifier");
    await addParty(agreementId, reviewer.owner, "verifier");
  }
}

export async function canAccessSandbox(id: string, owner: string) {
  const row = await database()
    .prepare(
      "SELECT 1 AS ok FROM agreements WHERE id = ? AND owner = ? UNION SELECT 1 FROM agreement_parties WHERE agreement_id = ? AND owner = ? LIMIT 1",
    )
    .bind(id, owner, id, owner)
    .first<{ ok: number }>();
  return Boolean(row);
}
