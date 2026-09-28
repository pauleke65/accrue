import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { network } from "@/lib/chain";
import { readDigitalJob } from "@/lib/digital-work-chain";
import { digitalJobId, verifyDigitalWrite, type DigitalJobRow } from "@/lib/digital-work-access";
import { parseDigitalPolicy, policyHash } from "@/lib/digital-work-policy";
import { parseProofsParam, verifiedAddresses } from "@/lib/live-agreements-access";
import { authorize, database, failure, HttpError } from "@/lib/server";

const createSchema = z.object({
  onchainId: z.string().regex(/^\d{1,20}$/),
  policy: z.unknown(),
  payer: z.string(),
  signature: z.string(),
}).strict();

export async function GET(request: Request) {
  try {
    await authorize();
    const addresses = await verifiedAddresses(parseProofsParam(new URL(request.url)));
    if (!addresses.length) return Response.json({ jobs: [] });
    const marks = addresses.map(() => "?").join(",");
    const result = await database()
      .prepare(
        `SELECT * FROM digital_jobs WHERE payer_address IN (${marks})` +
        ` OR worker_address IN (${marks}) OR verifier_a IN (${marks})` +
        ` OR verifier_b IN (${marks}) OR verifier_c IN (${marks})` +
        " ORDER BY created_at DESC LIMIT 50",
      )
      .bind(...addresses, ...addresses, ...addresses, ...addresses, ...addresses)
      .all<DigitalJobRow>();
    return Response.json({
      jobs: result.results.map((row) => ({
        id: row.id,
        onchainId: row.onchain_id,
        title: row.title,
        policy: JSON.parse(row.policy_json) as unknown,
        policyHash: row.policy_hash,
        payer: row.payer_address,
        worker: row.worker_address,
        verifiers: [row.verifier_a, row.verifier_b, row.verifier_c],
        createdAt: row.created_at,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const body = createSchema.parse(await request.json());
    if (!isAddress(body.payer)) throw new HttpError(400, "Valid payer address required.");
    const payer = getAddress(body.payer);
    const policy = parseDigitalPolicy(body.policy);
    const digest = policyHash(policy);
    const id = digitalJobId(body.onchainId);
    const chainJob = await readDigitalJob(BigInt(body.onchainId));
    if (chainJob.payer.toLowerCase() !== payer.toLowerCase() || chainJob.policyHash !== digest)
      throw new HttpError(409, "Policy or payer does not match the on-chain job.");
    await verifyDigitalWrite(payer, body.signature, "create", id, digest);
    if (chainJob.deliveryDeadline <= BigInt(Math.floor(Date.now() / 1000)))
      throw new HttpError(409, "This job's delivery period has ended.");

    await database().prepare(
      "INSERT INTO digital_jobs(id,onchain_id,title,policy_json,policy_hash,payer_address," +
      "worker_address,verifier_a,verifier_b,verifier_c,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)" +
      " ON CONFLICT(id) DO NOTHING",
    ).bind(
      id, body.onchainId, policy.title, JSON.stringify(policy), digest,
      payer, chainJob.worker, ...chainJob.verifiers, new Date().toISOString(),
    ).run();
    const saved = await database().prepare("SELECT policy_hash,payer_address FROM digital_jobs WHERE id=?")
      .bind(id).first<{ policy_hash: string; payer_address: string }>();
    if (saved?.policy_hash !== digest || saved.payer_address.toLowerCase() !== payer.toLowerCase())
      throw new HttpError(409, "This job already has different readable terms.");
    return Response.json({ id, chainId: network.chainId }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
