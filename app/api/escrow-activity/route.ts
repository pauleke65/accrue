import { env } from "cloudflare:workers";
import { authorize, database, failure } from "@/lib/server";
import { decodeEventLog } from "viem";
import { escrow, network } from "@/lib/chain";
import { escrowAbi } from "@/lib/escrow";

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
  | "correction";

function apiToken(): string | null {
  const value = (env as Record<string, unknown>).ENVIO_API_TOKEN;
  return typeof value === "string" && value.length > 8 ? value : null;
}

export async function GET() {
  try {
    const owner = await authorize();

    const rows = await database()
      .prepare(
        "SELECT onchain_id, title, milestones FROM live_agreements WHERE owner = ?",
      )
      .bind(owner)
      .all<{ onchain_id: string; title: string; milestones: string }>();

    const known = new Map<
      string,
      { title: string; milestones: { title: string }[] }
    >();
    for (const row of rows.results)
      known.set(row.onchain_id, {
        title: row.title,
        milestones: JSON.parse(row.milestones) as { title: string }[],
      });

    const configured = apiToken();
    if (!configured)
      return Response.json({
        configured: false,
        reason:
          "Add an Envio API token to read the funded-job activity feed from the chain.",
        entries: [],
      });

    if (known.size === 0)
      return Response.json({
        configured: true,
        entries: [],
      });

    const response = await fetch("https://monad-testnet.hypersync.xyz/query", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${configured}`,
      },
      body: JSON.stringify({
        from_block: 0,
        logs: [{ address: [escrow.address] }],
        field_selection: {
          log: [
            "block_number",
            "transaction_hash",
            "log_index",
            "topic0",
            "topic1",
            "topic2",
            "topic3",
            "data",
          ],
          block: ["number", "timestamp"],
        },
      }),
    });
    if (!response.ok)
      return Response.json({
        configured: true,
        entries: [],
        error: "The indexer did not respond; try again shortly.",
      });

    const result = (await response.json()) as {
      data?: {
        logs?: {
          block_number: number;
          transaction_hash: string;
          log_index: number;
          topic0: string;
          topic1: string;
          topic2: string;
          topic3?: string;
          data: string;
        }[];
        blocks?: { number: number; timestamp: string }[];
      }[];
    };

    const times = new Map<number, number>();
    for (const page of result.data ?? [])
      for (const block of page.blocks ?? [])
        times.set(Number(block.number), Number(block.timestamp));

    const entries: {
      hash: string;
      logIndex: number;
      at: string;
      kind: Kind;
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
        const topics = [log.topic0, log.topic1, log.topic2, log.topic3].filter(
          (t): t is string => Boolean(t),
        );
        let decoded;
        try {
          decoded = decodeEventLog({
            abi: escrowAbi,
            data: log.data as `0x${string}`,
            topics: topics as [`0x${string}`, ...`0x${string}`[]],
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
