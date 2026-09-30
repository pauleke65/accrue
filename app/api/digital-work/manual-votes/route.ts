import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { contractOfJobId, digitalJobId, readAuthorizedDigitalJob, verifyDigitalWrite } from "@/lib/digital-work-access";
import { readDigitalJob, readDigitalVote } from "@/lib/digital-work-chain";
import { manualVoteHash } from "@/lib/digital-work-policy";
import { parseProofsParam } from "@/lib/live-agreements-access";
import { authorize, database, failure, HttpError } from "@/lib/server";

const voteSchema = z.object({
  onchainId: z.string().regex(/^\d{1,20}$/),
  contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  version: z.number().int().min(1).max(100),
  evidenceHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  verifier: z.string(),
  pass: z.boolean(),
  notes: z.string().trim().min(3).max(1000),
  signature: z.string(),
}).strict();

export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const onchainId = url.searchParams.get("onchainId") ?? "";
    const contract = url.searchParams.get("contract");
    await readAuthorizedDigitalJob(onchainId, parseProofsParam(url), contract);
    const result = await database().prepare(
      "SELECT version,verifier_address,pass,notes,report_hash,created_at" +
      " FROM digital_manual_votes WHERE job_id=? ORDER BY version DESC,created_at ASC LIMIT 50",
    ).bind(digitalJobId(onchainId, contract)).all<{
      version: number; verifier_address: string; pass: number; notes: string;
      report_hash: string; created_at: string;
    }>();
    return Response.json({ votes: result.results.map((row) => ({
      version: row.version,
      verifier: row.verifier_address,
      pass: row.pass === 1,
      notes: row.notes,
      reportHash: row.report_hash,
      createdAt: row.created_at,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const body = voteSchema.parse(await request.json());
    if (!isAddress(body.verifier)) throw new HttpError(400, "Valid verifier address required.");
    const verifier = getAddress(body.verifier);
    const jobId = digitalJobId(body.onchainId, body.contract);
    const at = contractOfJobId(jobId);
    const chainJob = await readDigitalJob(BigInt(body.onchainId), at);
    if (!chainJob.verifiers.some((address) => address.toLowerCase() === verifier.toLowerCase()))
      throw new HttpError(403, "This address is not a verifier on the job.");
    const reportHash = manualVoteHash({
      jobId, version: body.version, evidenceHash: body.evidenceHash as `0x${string}`,
      verifier, pass: body.pass, notes: body.notes,
    });
    await verifyDigitalWrite(verifier, body.signature, "vote", jobId, reportHash);
    const vote = await readDigitalVote(BigInt(body.onchainId), verifier, at);
    if (vote.version !== body.version || vote.pass !== body.pass || vote.reportHash.toLowerCase() !== reportHash.toLowerCase())
      throw new HttpError(409, "Readable review does not match the on-chain vote.");
    await database().prepare(
      "INSERT INTO digital_manual_votes(job_id,version,verifier_address,pass,notes,report_hash,created_at)" +
      " VALUES(?,?,?,?,?,?,?) ON CONFLICT(job_id,version,verifier_address) DO NOTHING",
    ).bind(jobId, body.version, verifier, body.pass ? 1 : 0, body.notes,
      reportHash, new Date().toISOString()).run();
    return Response.json({ reportHash }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
