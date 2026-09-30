import { env } from "cloudflare:workers";
import { authorize, failure } from "@/lib/server";
import { decodeEventLog } from "viem";
import { escrow, network } from "@/lib/chain";
import { escrowAbi } from "@/lib/escrow";
import {
  accessibleLiveAgreements,
  parseProofsParam,
  verifiedAddresses,
} from "@/lib/live-agreements-access";
import { digitalWorkAbi, digitalWorkAddress } from "@/lib/digital-work-chain";
import { digitalJobId, type DigitalJobRow } from "@/lib/digital-work-access";
import { database } from "@/lib/server";

/**
 * A real activity feed for funded jobs, read from the escrow contract's own
 * event log with Envio HyperSync.
 *
 * Every entry here is something the contract actually recorded — an
 * acceptance, a funding, a submission, an approval that moved money, a
 * withdrawal, a correction — not a description of it. The app supplies only
 * the readable title behind each agreement and milestone id, the same text
 * the app stores because the contract keeps only their hashes.
 *
 * Scoped to agreements this workspace has recorded terms for: a shared
 * testnet contract carries other people's jobs too, and this feed is a
 * personal record, not a public firehose.
 */

type Kind =
  | "created"
  | "accepted"
  | "funded"
  | "evidence"
  | "changes"
  | "approved"
  | "withdrawn"
  | "cancel-consent"
  | "refunded"
  | "correction"
  | "vote"
  | "settled";

type HyperLog = {
  block_number: number;
  transaction_hash: string;
  log_index: number;
  topic0: string;
  topic1: string;
  topic2: string;
  topic3?: string;
  data: string;
};

type HyperResult = {
  data?: { logs?: HyperLog[]; blocks?: { number: number; timestamp: string }[] }[];
};

/** Every log one contract ever emitted, with block timestamps. */
async function readLogs(token: string, address: string): Promise<HyperResult | null> {
  const response = await fetch("https://monad-testnet.hypersync.xyz/query", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      from_block: 0,
      logs: [{ address: [address] }],
      field_selection: {
        log: ["block_number", "transaction_hash", "log_index", "topic0", "topic1", "topic2", "topic3", "data"],
        block: ["number", "timestamp"],
      },
    }),
  });
  return response.ok ? ((await response.json()) as HyperResult) : null;
}

function topicsOf(log: HyperLog) {
  return [log.topic0, log.topic1, log.topic2, log.topic3].filter(
    (t): t is string => Boolean(t),
  ) as [`0x${string}`, ...`0x${string}`[]];
}

function apiToken(): string | null {
  const value = (env as Record<string, unknown>).ENVIO_API_TOKEN;
  return typeof value === "string" && value.length > 8 ? value : null;
}

export async function GET(request: Request) {
  try {
    const owner = await authorize();

    // Same access rule as the agreements list itself: this account's own
    // jobs, plus any where a proven signature names it as worker or
    // verifier — otherwise a genuine participant's activity feed would show
    // nothing for a job they actually did the work on.
    const proofs = parseProofsParam(new URL(request.url));
    const rows = await accessibleLiveAgreements(owner, proofs);

    const known = new Map<
      string,
      { title: string; milestones: { title: string }[] }
    >();
    for (const row of rows)
      known.set(row.onchain_id, {
        title: row.title,
        milestones: JSON.parse(row.milestones) as { title: string }[],
      });

    // Proof-checked jobs follow their own list's rule: visible to anyone who
    // proves they are the client, the worker or one of the three reviewers.
    const addresses = await verifiedAddresses(proofs);
    const proofJobs = new Map<string, string>();
    if (addresses.length && digitalWorkAddress()) {
      const marks = addresses.map(() => "?").join(",");
      const result = await database()
        .prepare(
          `SELECT * FROM digital_jobs WHERE payer_address IN (${marks})` +
          ` OR worker_address IN (${marks}) OR verifier_a IN (${marks})` +
          ` OR verifier_b IN (${marks}) OR verifier_c IN (${marks})`,
        )
        .bind(...addresses, ...addresses, ...addresses, ...addresses, ...addresses)
        .all<DigitalJobRow>();
      for (const row of result.results) proofJobs.set(row.onchain_id, row.title);
    }
    const mine = new Set(addresses.map((a) => a.toLowerCase()));

    const configured = apiToken();
    if (!configured)
      return Response.json({
        configured: false,
        reason:
          "Add an Envio API token to read the funded-job activity feed from the chain.",
        entries: [],
      });

    if (known.size === 0 && proofJobs.size === 0)
      return Response.json({
        configured: true,
        entries: [],
      });

    const proofAddress = digitalWorkAddress();
    const [result, proofResult] = await Promise.all([
      known.size ? readLogs(configured, escrow.address) : Promise.resolve({ data: [] } as HyperResult),
      proofJobs.size && proofAddress ? readLogs(configured, proofAddress) : Promise.resolve({ data: [] } as HyperResult),
    ]);
    if (!result || !proofResult)
      return Response.json({
        configured: true,
        entries: [],
        error: "The indexer did not respond; try again shortly.",
      });

    const times = new Map<number, number>();
    for (const page of [...(result.data ?? []), ...(proofResult.data ?? [])])
      for (const block of page.blocks ?? [])
        times.set(Number(block.number), Number(block.timestamp));

    const entries: {
      hash: string;
      logIndex: number;
      at: string;
      kind: Kind;
      source: "milestone" | "proof";
      agreementId: string;
      agreementTitle: string;
      milestoneTitle?: string;
      actor?: string;
      amount?: string;
      workerAmount?: string;
      verifierFee?: string;
    }[] = [];

    for (const page of result.data ?? []) {
      for (const log of page.logs ?? []) {
        let decoded;
        try {
          decoded = decodeEventLog({
            abi: escrowAbi,
            data: log.data as `0x${string}`,
            topics: topicsOf(log),
          });
        } catch {
          continue; // A log this ABI does not recognise is not this contract's business.
        }

        const args = decoded.args as unknown as Record<string, unknown>;
        const eventName = decoded.eventName as unknown as string;
        const id = String(args.id);
        const job = known.get(id);
        if (!job) continue; // Not an agreement this workspace has terms for.

        const at = times.get(Number(log.block_number));
        const base = {
          hash: log.transaction_hash,
          logIndex: log.log_index,
          at: at ? new Date(at * 1000).toISOString() : new Date().toISOString(),
          source: "milestone" as const,
          agreementId: id,
          agreementTitle: job.title,
        };
        const milestoneTitle = (index: unknown) =>
          job.milestones[Number(index)]?.title;

        switch (eventName) {
          case "AgreementCreated":
            entries.push({ ...base, kind: "created" });
            break;
          case "Accepted":
            entries.push({
              ...base,
              kind: "accepted",
              actor: String(args.participant),
            });
            break;
          case "Funded":
            entries.push({
              ...base,
              kind: "funded",
              amount: String(args.amount),
            });
            break;
          case "EvidenceSubmitted":
            entries.push({
              ...base,
              kind: "evidence",
              milestoneTitle: milestoneTitle(args.milestone),
            });
            break;
          case "ChangesRequested":
            entries.push({
              ...base,
              kind: "changes",
              milestoneTitle: milestoneTitle(args.milestone),
            });
            break;
          case "Approved":
            entries.push({
              ...base,
              kind: "approved",
              actor: String(args.approver),
              milestoneTitle: milestoneTitle(args.milestone),
              workerAmount: String(args.workerAmount),
              verifierFee: String(args.verifierFee),
            });
            break;
          case "Withdrawn":
            entries.push({
              ...base,
              kind: "withdrawn",
              actor: String(args.beneficiary),
              amount: String(args.amount),
            });
            break;
          case "CancellationConsent":
            entries.push({
              ...base,
              kind: "cancel-consent",
              actor: String(args.participant),
            });
            break;
          case "Refunded":
            entries.push({
              ...base,
              kind: "refunded",
              amount: String(args.amount),
            });
            break;
          case "Correction":
            entries.push({
              ...base,
              kind: "correction",
              actor: String(args.approver),
              milestoneTitle: milestoneTitle(args.milestone),
            });
            break;
        }
      }
    }

    for (const page of proofResult.data ?? []) {
      for (const log of page.logs ?? []) {
        let decoded;
        try {
          decoded = decodeEventLog({ abi: digitalWorkAbi, data: log.data as `0x${string}`, topics: topicsOf(log) });
        } catch {
          continue;
        }
        const args = decoded.args as unknown as Record<string, unknown>;
        const eventName = decoded.eventName as unknown as string;
        const at = times.get(Number(log.block_number));
        const stamp = {
          hash: log.transaction_hash,
          logIndex: log.log_index,
          at: at ? new Date(at * 1000).toISOString() : new Date().toISOString(),
          source: "proof" as const,
        };

        // Withdrawals pool across every job, so they carry no job id. Show
        // only this person's own.
        if (eventName === "Withdrawn") {
          if (mine.has(String(args.beneficiary).toLowerCase()))
            entries.push({ ...stamp, kind: "withdrawn", agreementId: "", agreementTitle: "Proof-checked jobs",
              actor: String(args.beneficiary), amount: String(args.amount) });
          continue;
        }
        const onchainId = String(args.id);
        const title = proofJobs.get(onchainId);
        if (!title) continue;
        const base = { ...stamp, agreementId: digitalJobId(onchainId), agreementTitle: title };
        switch (eventName) {
          case "JobCreated": entries.push({ ...base, kind: "created" }); break;
          case "WorkerAccepted": entries.push({ ...base, kind: "accepted" }); break;
          case "Funded": entries.push({ ...base, kind: "funded", amount: String(args.amount) }); break;
          case "EvidenceSubmitted": entries.push({ ...base, kind: "evidence", milestoneTitle: `version ${String(args.version)}` }); break;
          case "ChangesRequested": entries.push({ ...base, kind: "changes", milestoneTitle: `version ${String(args.version)}` }); break;
          case "VerificationVoted":
            entries.push({ ...base, kind: "vote", actor: String(args.verifier), milestoneTitle: args.pass ? "pass" : "fail" });
            break;
          case "Settled": entries.push({ ...base, kind: "settled", amount: String(args.workerAmount) }); break;
          case "Refunded": entries.push({ ...base, kind: "refunded", amount: String(args.payerAmount) }); break;
        }
      }
    }

    entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    return Response.json(
      {
        configured: true,
        chainId: network.chainId,
        entries: entries.slice(0, 150),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
