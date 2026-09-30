import { getAddress, isAddress } from "viem";
import { explorer } from "./chain";
import { digitalWorkAbi, digitalWorkAddress, DigitalWorkStatus, readDigitalJob } from "./digital-work-chain";
import { contractOfJobId } from "./digital-work-id";
import { deliverableKind, parseDigitalPolicy, type DeliverableKind } from "./digital-work-policy";
import { readAgreement, readMilestones } from "./escrow";
import { publicClient } from "./ausd";
import { database } from "./server";

/**
 * A public record of someone's verified work.
 *
 * Every paid job is already on chain: who was paid, how much, and when. That
 * makes a work history anyone can check rather than take on trust. Titles and
 * briefs stay private to each job's participants, as they are everywhere else
 * in the app, so the profile shows only facts the chain already makes public,
 * each with a link to verify it.
 */

export type ProfileItem = {
  key: string;
  role: "worker" | "reviewer";
  flow: "proof" | "milestone";
  /** For proof-checked jobs, what kind of deliverable was verified. */
  deliverable: DeliverableKind | null;
  /** Milestone jobs pay by stage: how many of how many were approved. */
  stages: { approved: number; total: number } | null;
  amount: string;
  date: string;
  jobNumber: string;
  contract: string;
  verifyUrl: string;
};

export type Profile = {
  tag: string;
  displayName: string;
  address: `0x${string}`;
  since: string | null;
  worker: { jobs: number; earned: string };
  reviewer: { decisions: number; earned: string };
  items: ProfileItem[];
};

type DigitalRow = {
  id: string; onchain_id: string; policy_json: string; worker_address: string;
  verifier_a: string; verifier_b: string; verifier_c: string; created_at: string;
};
type MilestoneRow = { onchain_id: string; escrow: string; worker_address: string; created_at: string };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export async function loadProfile(handle: string): Promise<Profile | null> {
  const db = database();
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const row = isAddress(clean)
    ? await db.prepare("SELECT tag, display_name, address FROM tags WHERE lower(address) = lower(?) LIMIT 1").bind(clean).first<{ tag: string; display_name: string; address: string }>()
    : await db.prepare("SELECT tag, display_name, address FROM tags WHERE tag = ?").bind(clean).first<{ tag: string; display_name: string; address: string }>();
  if (!row) return null;
  const address = getAddress(row.address);
  const lower = address.toLowerCase();
  const items: ProfileItem[] = [];

  // Proof-checked jobs: paid as the worker, or a fee earned as a reviewer.
  const proofAddress = digitalWorkAddress();
  if (proofAddress) {
    const jobs = await db.prepare(
      "SELECT id, onchain_id, policy_json, worker_address, verifier_a, verifier_b, verifier_c, created_at FROM digital_jobs" +
      " WHERE lower(worker_address) = ? OR lower(verifier_a) = ? OR lower(verifier_b) = ? OR lower(verifier_c) = ?" +
      " ORDER BY created_at DESC LIMIT 100",
    ).bind(lower, lower, lower, lower).all<DigitalRow>();
    await Promise.all(jobs.results.map(async (job) => {
      // Each job is read from the deployment it lives on.
      const at = contractOfJobId(job.id);
      const chain = await readDigitalJob(BigInt(job.onchain_id), at).catch(() => null);
      if (!chain) return;
      let deliverable: DeliverableKind | null = null;
      try { deliverable = deliverableKind(parseDigitalPolicy(JSON.parse(job.policy_json))); } catch { /* unreadable policy: omit the kind */ }
      const base = {
        flow: "proof" as const, deliverable, stages: null, date: job.created_at, jobNumber: job.onchain_id,
        contract: at, verifyUrl: explorer.address(at),
      };
      if (same(job.worker_address, address) && chain.status === DigitalWorkStatus.paid)
        items.push({ ...base, key: `p-w-${job.onchain_id}`, role: "worker", amount: chain.reward.toString() });
      if ([job.verifier_a, job.verifier_b, job.verifier_c].some((v) => same(v, address))) {
        const earned = await publicClient().readContract({
          address: at, abi: digitalWorkAbi, functionName: "feeEarned", args: [BigInt(job.onchain_id), address],
        }).catch(() => false) as boolean;
        if (earned) items.push({ ...base, key: `p-r-${job.onchain_id}`, role: "reviewer", amount: (chain.feePool / 3n).toString() });
      }
    }));
  }

  // Milestone jobs on the current escrow: approved stages as worker or reviewer.
  const milestones = await db.prepare(
    "SELECT onchain_id, escrow, worker_address, created_at FROM live_agreements" +
    " WHERE lower(worker_address) = ? OR lower(verifier_address) = ? ORDER BY created_at DESC LIMIT 100",
  ).bind(lower, lower).all<MilestoneRow>();
  await Promise.all(milestones.results.map(async (m) => {
    const at = m.escrow as `0x${string}`;
    const chain = await readAgreement(BigInt(m.onchain_id), at).catch(() => null);
    if (!chain) return;
    const list = await readMilestones(BigInt(m.onchain_id), at).catch(() => null);
    const total = Array.isArray(list) ? list.length : 0;
    const stages = { approved: Number(chain.nextMilestone), total };
    const base = {
      flow: "milestone" as const, deliverable: null, stages, date: m.created_at, jobNumber: m.onchain_id,
      contract: at, verifyUrl: explorer.address(at),
    };
    if (same(chain.worker, address) && chain.workerEarned > 0n)
      items.push({ ...base, key: `m-w-${m.onchain_id}`, role: "worker", amount: chain.workerEarned.toString() });
    if (!/^0x0{40}$/i.test(chain.verifier) && same(chain.verifier, address) && chain.verifierEarned > 0n)
      items.push({ ...base, key: `m-r-${m.onchain_id}`, role: "reviewer", amount: chain.verifierEarned.toString() });
  }));

  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  const sum = (role: ProfileItem["role"]) => items.filter((i) => i.role === role).reduce((s, i) => s + BigInt(i.amount), 0n).toString();
  return {
    tag: row.tag,
    displayName: row.display_name,
    address,
    since: items.length ? items[items.length - 1].date : null,
    worker: { jobs: items.filter((i) => i.role === "worker").length, earned: sum("worker") },
    reviewer: { decisions: items.filter((i) => i.role === "reviewer").length, earned: sum("reviewer") },
    items,
  };
}
