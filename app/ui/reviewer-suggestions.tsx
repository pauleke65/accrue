"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

export type PoolReviewer = { address: string; tag: string; displayName: string; skills: string };

/**
 * Everyone who has joined the reviewer pool. Shared by the forms and Home for
 * a short while, so opening a form doesn't refetch, but a pool that changed
 * (someone joined a minute ago) shows up the next time a form opens.
 */
let cached: { at: number; list: Promise<PoolReviewer[]> } | null = null;
const FRESH_MS = 15_000;
export function loadReviewerPool(): Promise<PoolReviewer[]> {
  if (!cached || Date.now() - cached.at > FRESH_MS)
    cached = {
      at: Date.now(),
      list: fetch("/api/reviewers", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ reviewers: PoolReviewer[] }>) : { reviewers: [] }))
        .then((d) => d.reviewers)
        .catch(() => []),
    };
  return cached.list;
}

/** Call after joining or leaving so the next read is fresh. */
export function forgetReviewerPool(): void {
  cached = null;
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
