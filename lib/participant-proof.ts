/**
 * The exact text a participant signs to prove they control an address —
 * shared between client and server so the two sides can never disagree about
 * what was actually signed.
 *
 * This is a read-access proof, not a payment authorization. Unlike a tag
 * claim, a stale or replayed signature here does no real harm: the worst it
 * grants is read access to text about a role that address already controls
 * on chain — an address that could sign for that role regardless. It follows
 * the tag claim's own fixed-message pattern rather than inventing a second
 * convention for a lower-stakes case.
 */
export function participantProofMessage(address: string): string {
  return `Accrue: show funded jobs for ${address}`;
}
