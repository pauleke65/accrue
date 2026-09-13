import { authorize, database, failure, HttpError } from "@/lib/server";
import { isAddress, getAddress } from "viem";

/**
 * Readable terms for agreements whose money lives on chain.
 *
 * The contract stores hashes of the scope and each milestone's criteria, not
 * the text, because a home address and a description of someone's renovation
 * do not belong in public state. This endpoint keeps the text those hashes
 * cover so the app can show people what they agreed to.
 *
 * It holds no balances, no statuses and no allocations. Everything financial
 * is read from the chain each time it is displayed, so this record cannot
 * disagree with the money.
 */

const HEX = /^0x[0-9a-fA-F]{64}$/;

export async function GET() {
  try {
    const owner = await authorize();
    const rows = await database()
      .prepare(
        "SELECT id, chain_id, escrow, onchain_id, title, scope, payer_address," +
          " worker_address, verifier_address, worker_tag, verifier_tag, milestones, created_at" +
          " FROM live_agreements WHERE owner = ? ORDER BY created_at DESC LIMIT 50",
      )
      .bind(owner)
      .all<Record<string, string | number>>();

    return Response.json(
      {
        agreements: rows.results.map((row) => ({
          id: row.id,
          chainId: row.chain_id,
          escrow: row.escrow,
          onchainId: row.onchain_id,
          title: row.title,
          scope: row.scope,
          payer: row.payer_address,
          worker: row.worker_address,
          verifier: row.verifier_address,
          workerTag: row.worker_tag,
          verifierTag: row.verifier_tag,
          milestones: JSON.parse(String(row.milestones)) as unknown,
          createdAt: row.created_at,
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
      chainId?: number;
      escrow?: string;
      onchainId?: string;
      title?: string;
      scope?: string;
      payer?: string;
      worker?: string;
      verifier?: string;
      workerTag?: string | null;
      verifierTag?: string | null;
      milestones?: {
        title?: string;
        criteria?: string;
        workerAmount?: string;
        verifierFee?: string;
        criteriaHash?: string;
      }[];
    };

    const title = body.title?.trim().slice(0, 200);
    const scope = body.scope?.trim().slice(0, 4000);
    if (!title || !scope)
      throw new HttpError(400, "A title and scope are required.");
    if (!body.onchainId || !/^\d{1,20}$/.test(body.onchainId))
      throw new HttpError(400, "An on-chain identifier is required.");
    if (!body.escrow || !isAddress(body.escrow))
      throw new HttpError(400, "A valid escrow address is required.");
    for (const key of ["payer", "worker", "verifier"] as const) {
      const value = body[key];
      if (!value || !isAddress(value))
        throw new HttpError(400, `A valid ${key} address is required.`);
    }
    const milestones = body.milestones ?? [];
    if (!milestones.length || milestones.length > 12)
      throw new HttpError(400, "An agreement needs 1 to 12 milestones.");
    for (const m of milestones) {
      if (!m.title?.trim() || !m.criteria?.trim())
        throw new HttpError(400, "Every milestone needs a title and criteria.");
      if (!m.criteriaHash || !HEX.test(m.criteriaHash))
        throw new HttpError(400, "Every milestone needs its criteria hash.");
      if (!/^\d{1,40}$/.test(m.workerAmount ?? ""))
        throw new HttpError(400, "Milestone amounts must be in base units.");
    }

    const id = `${body.chainId}:${getAddress(body.escrow)}:${body.onchainId}`;
    const held = await database()
      .prepare("SELECT count(*) as n FROM live_agreements WHERE owner = ?")
      .bind(owner)
      .first<{ n: number }>();
    if ((held?.n ?? 0) >= 50)
      throw new HttpError(429, "This workspace has enough live agreements.");

    await database()
      .prepare(
        "INSERT INTO live_agreements(id,owner,chain_id,escrow,onchain_id,title,scope," +
          "payer_address,worker_address,verifier_address,worker_tag,verifier_tag,milestones,created_at)" +
          " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)" +
          " ON CONFLICT(id) DO NOTHING",
      )
      .bind(
        id,
        owner,
        body.chainId ?? 0,
        getAddress(body.escrow),
        body.onchainId,
        title,
        scope,
        getAddress(body.payer!),
        getAddress(body.worker!),
        getAddress(body.verifier!),
        body.workerTag?.slice(0, 24) ?? null,
        body.verifierTag?.slice(0, 24) ?? null,
        JSON.stringify(
          milestones.map((m) => ({
            title: m.title!.trim().slice(0, 200),
            criteria: m.criteria!.trim().slice(0, 2000),
            criteriaHash: m.criteriaHash,
            workerAmount: m.workerAmount,
            verifierFee: m.verifierFee ?? "0",
          })),
        ),
        new Date().toISOString(),
      )
      .run();

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
