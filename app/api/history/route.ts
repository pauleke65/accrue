import { env } from "cloudflare:workers";
import { authorize, failure, HttpError } from "@/lib/server";
import { isAddress, getAddress, decodeEventLog, parseAbiItem } from "viem";
import { network, token, escrow } from "@/lib/chain";

/**
 * Payment history, read with Envio HyperSync.
 *
 * The plain RPC caps eth_getLogs at a hundred blocks — under two minutes of
 * chain — so an account's past payments genuinely cannot be recovered from it.
 * HyperSync answers the same question over the whole chain in one request,
 * which is the difference between a ledger that starts when the app first saw
 * you and one that is actually complete.
 *
 * The app's own record still exists and still decides what is pending; this
 * endpoint is what makes history independent of it. Where they disagree, the
 * chain is right.
 */

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function endpoint() {
  return `https://monad-testnet.hypersync.xyz/query`;
}

function apiToken(): string | null {
  const value = (env as Record<string, unknown>).ENVIO_API_TOKEN;
  return typeof value === "string" && value.length > 8 ? value : null;
}

export async function GET(request: Request) {
  try {
    await authorize();
    const configured = apiToken();
    const url = new URL(request.url);
    const address = url.searchParams.get("address");

    if (!configured)
      return Response.json({
        configured: false,
        reason:
          "Add an Envio API token to read full history. Without it the app shows only payments it recorded itself.",
      });

    if (!address || !isAddress(address))
      throw new HttpError(400, "A valid account address is required.");
    const account = getAddress(address);
    const padded = `0x${account.slice(2).toLowerCase().padStart(64, "0")}`;

    // One query covering both directions: tokens this account sent and
    // received. HyperSync filters on indexed topics, so this stays cheap.
    const body = {
      from_block: 0,
      logs: [
        { address: [token.address], topics: [[TRANSFER_TOPIC], [padded], []] },
        { address: [token.address], topics: [[TRANSFER_TOPIC], [], [padded]] },
      ],
      field_selection: {
        log: [
          "block_number",
          "transaction_hash",
          "log_index",
          "address",
          "topic0",
          "topic1",
          "topic2",
          "data",
        ],
        block: ["number", "timestamp"],
      },
    };

    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${configured}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new HttpError(
        502,
        `The indexer refused the request: ${detail.slice(0, 160)}`,
      );
    }

    const result = (await response.json()) as {
      data?: {
        logs?: {
          block_number: number;
          transaction_hash: string;
          log_index: number;
          topic0: string;
          topic1: string;
          topic2: string;
          data: string;
        }[];
        blocks?: { number: number; timestamp: string }[];
      }[];
      next_block?: number;
    };

    const times = new Map<number, number>();
    for (const page of result.data ?? [])
      for (const block of page.blocks ?? [])
        times.set(Number(block.number), Number(block.timestamp));

    const transfers = [];
    for (const page of result.data ?? []) {
      for (const log of page.logs ?? []) {
        try {
          const decoded = decodeEventLog({
            abi: [TRANSFER],
            data: log.data as `0x${string}`,
            topics: [log.topic0, log.topic1, log.topic2] as [
              `0x${string}`,
              `0x${string}`,
              `0x${string}`,
            ],
          });
          const from = getAddress(decoded.args.from);
          const to = getAddress(decoded.args.to);
          transfers.push({
            hash: log.transaction_hash,
            logIndex: log.log_index,
            block: log.block_number,
            at: times.get(Number(log.block_number)) ?? null,
            from,
            to,
            amount: decoded.args.value.toString(),
            direction: from === account ? "out" : "in",
            // Money moving to or from the escrow is a job, not a person.
            counterpartyIsEscrow:
              from === getAddress(escrow.address) ||
              to === getAddress(escrow.address),
          });
        } catch {
          // A log that will not decode is not worth failing the page over.
        }
      }
    }

    // Newest first, and stable when several land in one block.
    transfers.sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);

    return Response.json(
      {
        configured: true,
        source: "Envio HyperSync",
        chainId: network.chainId,
        count: transfers.length,
        transfers: transfers.slice(0, 100),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
