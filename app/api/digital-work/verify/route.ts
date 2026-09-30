import { env } from "cloudflare:workers";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, keccak256, stringToHex, type Hash } from "viem";
import { z } from "zod";
import { publicClient } from "@/lib/ausd";
import { chain, network } from "@/lib/chain";
import { readAuthorizedDigitalJob } from "@/lib/digital-work-access";
import { digitalWorkAbi, DigitalWorkStatus } from "@/lib/digital-work-chain";
import { parseDigitalManifest, parseDigitalPolicy } from "@/lib/digital-work-policy";
import { assessWithJev, assessWithoutAi, runChecks } from "@/lib/jev-verifier";
import { parseProofsParam, type ParticipantProof } from "@/lib/live-agreements-access";
import { authorize, database, failure, HttpError } from "@/lib/server";

const requestSchema = z.object({
  onchainId: z.string().regex(/^\d{1,20}$/),
  contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  version: z.number().int().min(1).max(100),
  proofs: z.array(z.object({ address: z.string(), signature: z.string() })).min(1).max(8),
}).strict();

type StoredRun = {
  state: string;
  report_json: string | null;
  report_hash: string | null;
  vote_tx: string | null;
  updated_at: string;
};

async function getRun(jobId: string, version: number): Promise<StoredRun | null> {
  return database().prepare(
    "SELECT state,report_json,report_hash,vote_tx,updated_at FROM digital_verification_runs" +
    " WHERE job_id=? AND version=?",
  ).bind(jobId, version).first<StoredRun>();
}

async function submitJevVote(
  contract: `0x${string}`,
  onchainId: string,
  evidenceHash: Hash,
  reportHash: Hash,
  recommendation: "pass" | "fail" | "manual_review",
  namedVerifiers: readonly string[],
): Promise<Hash | null> {
  if (recommendation === "manual_review") return null;
  const key = env.ACCRUE_JEV_VERIFIER_KEY;
  if (!key || !/^0x[a-fA-F0-9]{64}$/.test(key)) return null;
  const account = privateKeyToAccount(key as Hash);
  if (!namedVerifiers.some((address) => address.toLowerCase() === account.address.toLowerCase()))
    throw new HttpError(409, "The configured Proof Engine verifier is not named on this agreement.");
  const address = contract;
  const jevWallet = createWalletClient({
    account, chain, transport: http(network.rpcUrls[1], { timeout: 30_000 }),
  });
  const hash = await jevWallet.writeContract({
    address,
    abi: digitalWorkAbi,
    functionName: "vote",
    args: [BigInt(onchainId), evidenceHash, recommendation === "pass", reportHash],
    account,
    chain,
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 40_000 });
  if (receipt.status !== "success") throw new HttpError(502, "Proof Engine's vote transaction reverted.");
  return hash;
}

export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const onchainId = url.searchParams.get("onchainId") ?? "";
    const { row } = await readAuthorizedDigitalJob(onchainId, parseProofsParam(url), url.searchParams.get("contract"));
    const runs = await database().prepare(
      "SELECT version,state,report_json,report_hash,vote_tx,updated_at" +
      " FROM digital_verification_runs WHERE job_id=? ORDER BY version DESC LIMIT 20",
    ).bind(row.id).all<StoredRun & { version: number }>();
    return Response.json({ runs: runs.results.map((run) => ({
      version: run.version,
      state: run.state,
      report: run.report_json ? JSON.parse(run.report_json) as unknown : null,
      reportHash: run.report_hash,
      voteTx: run.vote_tx,
      updatedAt: run.updated_at,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const body = requestSchema.parse(await request.json());
    const { row, chainJob, contract } = await readAuthorizedDigitalJob(
      body.onchainId, body.proofs as ParticipantProof[], body.contract,
    );
    if (chainJob.version !== body.version || chainJob.status !== DigitalWorkStatus.submitted)
      throw new HttpError(409, "There is no matching submission awaiting verification.");
    const submission = await database().prepare(
      "SELECT manifest_json,evidence_hash FROM digital_submissions WHERE job_id=? AND version=?",
    ).bind(row.id, body.version).first<{ manifest_json: string; evidence_hash: Hash }>();
    if (!submission || submission.evidence_hash.toLowerCase() !== chainJob.evidenceHash.toLowerCase())
      throw new HttpError(409, "Pinned evidence is missing or does not match the chain.");

    const prior = await getRun(row.id, body.version);
    if (prior?.state === "complete") return Response.json({
      report: prior.report_json ? JSON.parse(prior.report_json) as unknown : null,
      reportHash: prior.report_hash, voteTx: prior.vote_tx,
    });
    if (prior?.state === "report_ready" && prior.report_json && prior.report_hash) {
      const report = JSON.parse(prior.report_json) as { jev: { recommendation: "pass" | "fail" | "manual_review" } };
      const voteTx = await submitJevVote(contract, body.onchainId, chainJob.evidenceHash, prior.report_hash as Hash,
        report.jev.recommendation, chainJob.verifiers);
      if (voteTx) await database().prepare(
        "UPDATE digital_verification_runs SET state='complete',vote_tx=?,updated_at=? WHERE job_id=? AND version=?",
      ).bind(voteTx, new Date().toISOString(), row.id, body.version).run();
      return Response.json({ report, reportHash: prior.report_hash, voteTx });
    }

    const now = new Date();
    const retryBefore = new Date(now.getTime() - 60_000).toISOString();
    const lock = await database().prepare(
      "INSERT INTO digital_verification_runs(job_id,version,state,updated_at) VALUES(?,?,'running',?)" +
      " ON CONFLICT(job_id,version) DO UPDATE SET state='running',updated_at=excluded.updated_at" +
      " WHERE digital_verification_runs.state='failed' AND digital_verification_runs.updated_at < ?",
    ).bind(row.id, body.version, now.toISOString(), retryBefore).run();
    if ((lock.meta.changes ?? 0) !== 1)
      throw new HttpError(409, "Verification is already running. Refresh the report shortly.");

    try {
      const policy = parseDigitalPolicy(JSON.parse(row.policy_json));
      const manifest = parseDigitalManifest(JSON.parse(submission.manifest_json));
      const checks = await runChecks(policy, manifest);
      let jev;
      try {
        jev = await assessWithJev(policy, checks);
      } catch (cause) {
        // Retry later on a rate limit; otherwise let the checks stand alone.
        if (!(cause instanceof HttpError) || cause.status === 429) throw cause;
        jev = assessWithoutAi(checks, cause.message);
      }
      const report = {
        onchainId: body.onchainId,
        version: body.version,
        policyHash: row.policy_hash,
        evidenceHash: submission.evidence_hash,
        checks,
        jev,
        evaluatedAt: new Date().toISOString(),
      };
      const serialized = JSON.stringify(report);
      const reportHash = keccak256(stringToHex(serialized));
      await database().prepare(
        "UPDATE digital_verification_runs SET state='report_ready',report_json=?,report_hash=?,updated_at=?" +
        " WHERE job_id=? AND version=?",
      ).bind(serialized, reportHash, new Date().toISOString(), row.id, body.version).run();
      const voteTx = await submitJevVote(contract, body.onchainId, chainJob.evidenceHash,
        reportHash, jev.recommendation, chainJob.verifiers);
      if (voteTx || jev.recommendation === "manual_review") await database().prepare(
        "UPDATE digital_verification_runs SET state='complete',vote_tx=?,updated_at=?" +
        " WHERE job_id=? AND version=?",
      ).bind(voteTx, new Date().toISOString(), row.id, body.version).run();
      return Response.json({ report, reportHash, voteTx });
    } catch (error) {
      const run = await getRun(row.id, body.version);
      if (run?.state === "running") await database().prepare(
        "UPDATE digital_verification_runs SET state='failed',updated_at=? WHERE job_id=? AND version=?",
      ).bind(new Date().toISOString(), row.id, body.version).run();
      throw error;
    }
  } catch (error) {
    return failure(error);
  }
}
