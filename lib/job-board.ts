import { database } from "./server";

/**
 * Open hiring links whose clients chose to list them publicly. Only what a
 * candidate needs to decide whether to look closer: never addresses of
 * anyone but the client, and only the brief the client wrote for this.
 */

export type BoardJob = {
  token: string;
  kind: "proof" | "milestone";
  title: string;
  brief: string;
  pay: number;
  stages: number | null;
  deliverable: "webpage" | "pull_request" | "api" | null;
  days: number;
  clientTag: string | null;
  postedAt: string;
};

type Row = { token: string; kind: string; title: string; draft_json: string; created_at: string; tag: string | null };

export async function loadBoard(): Promise<BoardJob[]> {
  const result = await database()
    .prepare(
      "SELECT o.token, o.kind, o.title, o.draft_json, o.created_at, t.tag FROM job_offers o" +
      " LEFT JOIN tags t ON lower(t.address) = lower(o.client_address)" +
      " WHERE o.listed = 1 AND o.status = 'open' AND o.expires_at > ? ORDER BY o.created_at DESC LIMIT 100",
    )
    .bind(new Date().toISOString())
    .all<Row>();
  return result.results.map((row) => {
    const d = JSON.parse(row.draft_json) as Record<string, unknown>;
    if (row.kind === "proof") {
      const policy = (d.policy ?? {}) as Record<string, unknown>;
      const deliverable = policy.type === "webpage" || policy.type === "pull_request" ? policy.type : "api";
      return {
        token: row.token, kind: "proof", title: row.title, brief: String(policy.brief ?? ""),
        pay: Number(d.reward) || 0, stages: null, deliverable, days: Math.round(Number(d.deliveryHours ?? 0) / 24),
        clientTag: row.tag, postedAt: row.created_at,
      };
    }
    const milestones = (d.milestones ?? []) as { amount?: string }[];
    return {
      token: row.token, kind: "milestone", title: row.title, brief: String(d.scope ?? ""),
      pay: milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0), stages: milestones.length,
      deliverable: null, days: Number(d.days ?? 0), clientTag: row.tag, postedAt: row.created_at,
    };
  });
}
