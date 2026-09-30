import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { digitalJobId, readAuthorizedDigitalJob, verifyDigitalWrite } from "@/lib/digital-work-access";
import { readDigitalJob } from "@/lib/digital-work-chain";
import { assertManifestFits, evidenceHash, parseDigitalManifest, parseDigitalPolicy } from "@/lib/digital-work-policy";
import { parseProofsParam } from "@/lib/live-agreements-access";
import { authorize, database, failure, HttpError } from "@/lib/server";

const submissionSchema = z.object({
  onchainId: z.string().regex(/^\d{1,20}$/),
  version: z.number().int().min(1).max(100),
  manifest: z.unknown(),
  worker: z.string(),
  signature: z.string(),
}).strict();

export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const onchainId = url.searchParams.get("onchainId") ?? "";
    await readAuthorizedDigitalJob(onchainId, parseProofsParam(url));
    const rows = await database().prepare(
      "SELECT version,evidence_hash,manifest_json,created_at FROM digital_submissions" +
      " WHERE job_id=? ORDER BY version DESC LIMIT 20",
    ).bind(digitalJobId(onchainId)).all<{
      version: number; evidence_hash: string; manifest_json: string; created_at: string;
    }>();
    return Response.json({ submissions: rows.results.map((row) => ({
      version: row.version,
      evidenceHash: row.evidence_hash,
      manifest: JSON.parse(row.manifest_json) as unknown,
      createdAt: row.created_at,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const body = submissionSchema.parse(await request.json());
    if (!isAddress(body.worker)) throw new HttpError(400, "Valid worker address required.");
    const worker = getAddress(body.worker);
    const id = digitalJobId(body.onchainId);
    const manifest = parseDigitalManifest(body.manifest);
    const row = await database().prepare("SELECT policy_hash, policy_json FROM digital_jobs WHERE id=?")
      .bind(id).first<{ policy_hash: `0x${string}`; policy_json: string }>();
    if (!row) throw new HttpError(404, "Readable job policy not found.");
    try {
      assertManifestFits(parseDigitalPolicy(JSON.parse(row.policy_json)), manifest);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Evidence does not fit this job.");
    }
    const digest = evidenceHash(id, row.policy_hash, manifest);
    const chainJob = await readDigitalJob(BigInt(body.onchainId));
    if (chainJob.worker.toLowerCase() !== worker.toLowerCase() ||
        chainJob.version !== body.version || chainJob.evidenceHash.toLowerCase() !== digest.toLowerCase())
      throw new HttpError(409, "Submission does not match the on-chain evidence.");
    await verifyDigitalWrite(worker, body.signature, "submit", id, digest);
    await database().prepare(
      "INSERT INTO digital_submissions(job_id,version,evidence_hash,manifest_json,created_at)" +
      " VALUES(?,?,?,?,?) ON CONFLICT(job_id,version) DO NOTHING",
    ).bind(id, body.version, digest, JSON.stringify(manifest), new Date().toISOString()).run();
    const saved = await database().prepare(
      "SELECT evidence_hash FROM digital_submissions WHERE job_id=? AND version=?",
    ).bind(id, body.version).first<{ evidence_hash: string }>();
    if (saved?.evidence_hash !== digest)
      throw new HttpError(409, "This submission version already has different evidence.");
    return Response.json({ id, version: body.version, evidenceHash: digest }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
