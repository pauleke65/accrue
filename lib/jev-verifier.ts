import { env } from "cloudflare:workers";
import { z } from "zod";
import { type DigitalManifest, type DigitalPolicy, deploymentProbeUrl } from "./digital-work-policy";
import { HttpError } from "./server";

const MAX_RESPONSE_BYTES = 32_768;
const jevSchema = z.object({
  model: z.string(),
  answers: z.object({
    requirements_met: z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
    needs_human_review: z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
  }),
}).passthrough();

export type ApiCheckReport = {
  commitUrl: string;
  commitFound: boolean;
  probeUrl: string;
  responseStatus: number | null;
  expectedStatus: number;
  jsonKey: string;
  expectedValue: string;
  actualValue: string | null;
  statusMatches: boolean;
  bodyMatches: boolean;
  error: string | null;
};

export type JevAssessment = {
  model: string;
  requirementsProbability: number;
  reviewProbability: number;
  recommendation: "pass" | "fail" | "manual_review";
};

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Response exceeded the 32 KB verification limit.");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

export async function runApiChecks(
  policy: DigitalPolicy,
  manifest: DigitalManifest,
  fetcher: typeof fetch = fetch,
): Promise<ApiCheckReport> {
  const commitUrl = new URL(manifest.commitUrl);
  const apiCommitUrl = `https://api.github.com/repos${commitUrl.pathname.replace("/commit/", "/commits/")}`;
  const probeUrl = deploymentProbeUrl(policy, manifest);
  const report: ApiCheckReport = {
    commitUrl: manifest.commitUrl,
    commitFound: false,
    probeUrl,
    responseStatus: null,
    expectedStatus: policy.expectedStatus,
    jsonKey: policy.expectedJsonKey,
    expectedValue: policy.expectedJsonValue,
    actualValue: null,
    statusMatches: false,
    bodyMatches: false,
    error: null,
  };

  try {
    const commit = await fetcher(apiCommitUrl, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Accrue-Digital-Work" },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    report.commitFound = commit.status === 200;
    await commit.body?.cancel();
  } catch (error) {
    report.error = `Could not check the public commit: ${error instanceof Error ? error.message : "network error"}`;
  }

  try {
    const response = await fetcher(probeUrl, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    report.responseStatus = response.status;
    report.statusMatches = response.status === policy.expectedStatus;
    const body = JSON.parse(await readLimited(response)) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const field = (body as Record<string, unknown>)[policy.expectedJsonKey];
      report.actualValue = field == null ? null : String(field);
      report.bodyMatches = report.actualValue === policy.expectedJsonValue;
    }
  } catch (error) {
    report.error = `Could not verify the deployed endpoint: ${error instanceof Error ? error.message : "network error"}`;
  }
  return report;
}

async function invokeJev(state: unknown): Promise<unknown> {
  const questions = {
    requirements_met: {
      type: "noul",
      instructions: "Given only the locked policy and test report, is the submitted API outcome verified?",
      criteria: {
        true: "The public commit exists and the deployed endpoint matches the expected status and JSON value.",
        false: "Any required check failed or the available evidence is insufficient.",
      },
    },
    needs_human_review: {
      type: "noul",
      instructions: "Does this result need an independent human review before payment?",
      criteria: {
        true: "Evidence is ambiguous, inconsistent, or incomplete.",
        false: "The deterministic checks and submitted evidence agree clearly.",
      },
    },
  };
  if (env.ACCRUE_BEATAPI_API_KEY) {
    let response: Response;
    try {
      response = await fetch("https://api.beatapi.io/v1/systemone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.ACCRUE_BEATAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "jev-1.13-free", state, questions }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new HttpError(502, "Free Jev provider could not be reached. Review the evidence manually.");
    }
    if (response.status === 429)
      throw new HttpError(429, "Free Jev allows one successful request per minute. Retry shortly.");
    if (response.status === 401 || response.status === 403)
      throw new HttpError(503, "The BeatAPI Jev key was rejected. Check the server secret.");
    if (!response.ok)
      throw new HttpError(502, `Free Jev provider returned ${response.status}. Review manually.`);
    return response.json();
  }
  if (env.AI) {
    try {
      return await env.AI.run("typesafe/jev", { state, questions });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (/insufficient.*credits|2021/i.test(detail))
        throw new HttpError(503, "Cloudflare Jev needs AI Gateway credits on this account.");
      throw new HttpError(502, `Cloudflare Jev could not evaluate this evidence: ${detail.slice(0, 160)}`);
    }
  }
  if (!env.ACCRUE_CLOUDFLARE_ACCOUNT_ID || !env.ACCRUE_CLOUDFLARE_AI_TOKEN)
    throw new HttpError(503, "Jev is not configured. Add a free BeatAPI key or Cloudflare AI access.");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.ACCRUE_CLOUDFLARE_ACCOUNT_ID}/ai/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ACCRUE_CLOUDFLARE_AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "typesafe/jev", input: { state, questions } }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new HttpError(502, `Cloudflare Jev returned ${response.status}.`);
  const payload = await response.json() as { result?: unknown };
  return payload.result ?? payload;
}

export async function assessWithJev(
  policy: DigitalPolicy,
  report: ApiCheckReport,
): Promise<JevAssessment> {
  const raw = await invokeJev({ policy, testReport: report });
  const result = jevSchema.safeParse(raw);
  if (!result.success) throw new HttpError(502, "Jev returned an invalid evaluation response.");
  const requirementsProbability = result.data.answers.requirements_met.noul;
  const reviewProbability = result.data.answers.needs_human_review.noul;
  const deterministicPass = report.commitFound && report.statusMatches && report.bodyMatches;
  const recommendation = !deterministicPass || requirementsProbability <= policy.failThreshold
    ? "fail"
    : requirementsProbability >= policy.passThreshold && reviewProbability <= policy.failThreshold
      ? "pass"
      : "manual_review";
  return { model: result.data.model, requirementsProbability, reviewProbability, recommendation };
}
