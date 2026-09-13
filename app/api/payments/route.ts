import { authorize, database, failure, HttpError } from "@/lib/server";
import { isAddress, getAddress } from "viem";
import { publicClient } from "@/lib/ausd";

/**
 * The app's record of payments it sent.
 *
 * The chain decides whether a payment settled, but the node caps log queries
 * at a hundred blocks, so history cannot be rediscovered from it. This keeps
 * the reference; status is confirmed against the chain by hash whenever a row
 * is still pending, so a stored "confirmed" is something the chain said rather
 * than something the app assumed.
 */

const HASH = /^0x[0-9a-fA-F]{64}$/;

export async function GET() {
  try {
    const owner = await authorize();
    const rows = await database()
      .prepare(
        "SELECT hash, from_address, to_address, to_tag, amount, status, created_at" +
          " FROM payments WHERE owner = ? ORDER BY created_at DESC LIMIT 50",
      )
      .bind(owner)
      .all<{
        hash: string;
        from_address: string;
        to_address: string;
        to_tag: string | null;
        amount: string;
        status: string;
        created_at: string;
      }>();

    // Anything still pending is asked about rather than left to look stuck.
    const client = publicClient();
    const settled = await Promise.all(
      rows.results.map(async (row) => {
        if (row.status !== "pending") return row;
        try {
          const receipt = await client.getTransactionReceipt({
            hash: row.hash as `0x${string}`,
          });
          const status = receipt.status === "success" ? "confirmed" : "failed";
          await database()
            .prepare(
              "UPDATE payments SET status = ? WHERE hash = ? AND owner = ?",
            )
            .bind(status, row.hash, owner)
            .run();
          return { ...row, status };
        } catch {
          return row;
        }
      }),
    );

    return Response.json(
      {
        payments: settled.map((row) => ({
          hash: row.hash,
          from: row.from_address,
          to: row.to_address,
          toTag: row.to_tag,
          amount: row.amount,
          status: row.status,
          at: row.created_at,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await authorize(request);
    const body = (await request.json()) as {
      hash?: string;
      from?: string;
      to?: string;
      toTag?: string | null;
      amount?: string;
      status?: string;
    };

    if (!body.hash || !HASH.test(body.hash))
      throw new HttpError(400, "A transaction reference is required.");
    if (!body.from || !isAddress(body.from) || !body.to || !isAddress(body.to))
      throw new HttpError(400, "Valid account addresses are required.");
    if (!body.amount || !/^\d{1,40}$/.test(body.amount))
      throw new HttpError(400, "An amount in base units is required.");

    const status = ["pending", "confirmed", "failed"].includes(
      body.status ?? "",
    )
      ? body.status
      : "pending";

    await database()
      .prepare(
        "INSERT INTO payments(hash,owner,from_address,to_address,to_tag,amount,status,created_at)" +
          " VALUES(?,?,?,?,?,?,?,?)" +
          " ON CONFLICT(hash) DO UPDATE SET status = excluded.status",
      )
      .bind(
        body.hash,
        owner,
        getAddress(body.from),
        getAddress(body.to),
        body.toTag?.slice(0, 24) ?? null,
        body.amount,
        status,
        new Date().toISOString(),
      )
      .run();

    return Response.json({ hash: body.hash, status }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
