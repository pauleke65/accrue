import { env } from "cloudflare:workers";
import { z } from "zod";
import type { DigitalPolicy } from "./digital-work-policy";
import { checkItems, type CheckReport } from "./proof-checks";

export { runChecks, checkItems } from "./proof-checks";
export type { CheckItem, CheckReport } from "./proof-checks";
import { HttpError } from "./server";

const jevSchema = z.object({
  model: z.string(),
  answers: z.object({
    requirements_met: z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
    needs_human_review: z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
  }),
}).passthrough();

export type JevAssessment = {
  model: string;
  requirementsProbability: number;
  reviewProbability: number;
  recommendation: "pass" | "fail" | "manual_review";
  /** Set when the AI model could not be reached; the probabilities are then 0 and unused. */
  unavailable?: string;
};

/**
 * Proof Engine without its AI: when the model is not configured, out of
 * credits or erroring, the checks still stand on their own. A check that
 * fails is a fact, so the engine still votes fail; checks that all pass are
 * not enough to pay on, so it steps aside and the reviewers decide, with the
 * reason on the report. A rate limit is not handled here: it is retried.
 */
export function assessWithoutAi(report: CheckReport, reason: string): JevAssessment {
  const allPassed = checkItems(report).every((item) => item.passed);
  return {
    model: "unavailable",
    requirementsProbability: 0,
    reviewProbability: 0,
    recommendation: allPassed ? "manual_review" : "fail",
    unavailable: reason,
  };
}

async function invokeJev(state: unknown): Promise<unknown> {
  const questions = {
    requirements_met: {
      type: "noul",
      instructions: "Given only the locked policy and test report, is the submitted outcome verified against the brief?",
      criteria: {
        true: "Every required check in the report passed and the evidence plausibly satisfies the brief.",
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
      throw new HttpError(502, "Proof Engine could not reach its AI provider. Review the evidence manually.");
    }
    if (response.status === 429)
      throw new HttpError(429, "Proof Engine is rate limited. Retry in a minute.");
    if (response.status === 401 || response.status === 403)
      throw new HttpError(503, "Proof Engine provider credentials were rejected. Check the server secret.");
    if (!response.ok)
      throw new HttpError(502, `Proof Engine provider returned ${response.status}. Review manually.`);
    return response.json();
  }
  if (env.AI) {
    try {
      return await env.AI.run("typesafe/jev", { state, questions });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (/insufficient.*credits|2021/i.test(detail))
        throw new HttpError(503, "Proof Engine needs AI Gateway credits on this Cloudflare account.");
      throw new HttpError(502, `Proof Engine could not evaluate this evidence: ${detail.slice(0, 160)}`);
    }
  }
  if (!env.ACCRUE_CLOUDFLARE_ACCOUNT_ID || !env.ACCRUE_CLOUDFLARE_AI_TOKEN)
    throw new HttpError(503, "Proof Engine is not configured. Add a BeatAPI key or Cloudflare AI access.");
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
  if (!response.ok) throw new HttpError(502, `Proof Engine provider returned ${response.status}.`);
  const payload = await response.json() as { result?: unknown };
  return payload.result ?? payload;
}

export async function assessWithJev(
  policy: DigitalPolicy,
  report: CheckReport,
): Promise<JevAssessment> {
  const raw = await invokeJev({ policy, testReport: report });
  const result = jevSchema.safeParse(raw);
  if (!result.success) throw new HttpError(502, "Proof Engine received an invalid AI evaluation response.");
  const requirementsProbability = result.data.answers.requirements_met.noul;
  const reviewProbability = result.data.answers.needs_human_review.noul;
  const deterministicPass = checkItems(report).every((item) => item.passed);
  const recommendation = !deterministicPass || requirementsProbability <= policy.failThreshold
    ? "fail"
    : requirementsProbability >= policy.passThreshold && reviewProbability <= policy.failThreshold
      ? "pass"
      : "manual_review";
  return { model: result.data.model, requirementsProbability, reviewProbability, recommendation };
}
