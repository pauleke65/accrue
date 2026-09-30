"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

export type PoolReviewer = { address: string; tag: string; displayName: string; skills: string };

/** Everyone who has joined the reviewer pool. Cached per page load. */
let cached: Promise<PoolReviewer[]> | null = null;
export function loadReviewerPool(): Promise<PoolReviewer[]> {
  cached ??= fetch("/api/reviewers")
    .then((r) => (r.ok ? (r.json() as Promise<{ reviewers: PoolReviewer[] }>) : { reviewers: [] }))
    .then((d) => d.reviewers)
    .catch(() => []);
  return cached;
}

/**
 * Reviewers from the pool, one click to name. Leaves out anyone who can't
 * review this job: the client, the worker, or someone already named.
 */
export function ReviewerSuggestions({ exclude, onPick }: { exclude: string[]; onPick: (tag: string) => void }) {
  const [pool, setPool] = useState<PoolReviewer[] | null>(null);
  useEffect(() => {
    let active = true;
    void loadReviewerPool().then((list) => { if (active) setPool(list); });
    return () => { active = false; };
  }, []);

  const taken = new Set(exclude.map((v) => v.trim().replace(/^@/, "").toLowerCase()).filter(Boolean));
  const options = (pool ?? []).filter((r) => !taken.has(r.tag.toLowerCase()) && !taken.has(r.address.toLowerCase())).slice(0, 6);
  if (pool === null) return <p className="fine-print">Loading reviewers who have offered to help…</p>;
  if (!options.length)
    return <p className="fine-print">Nobody else is in the reviewer pool yet. Name people you both trust, or ask someone to join from their Home.</p>;

  return (
    <div className="reviewer-suggestions">
      <span className="mono-label">From the reviewer pool</span>
      <div>
        {options.map((r) => (
          <button type="button" key={r.address} className="reviewer-chip" onClick={() => onPick(`@${r.tag}`)} title={`Name @${r.tag} as a reviewer`}>
            <UserPlus size={14} aria-hidden />
            <span><b>@{r.tag}</b><small>{r.skills}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
