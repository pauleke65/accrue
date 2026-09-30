import { keccak256, stringToHex } from "viem";
import { z } from "zod";

const PUBLIC_DEPLOYMENT_SUFFIXES = [
  ".workers.dev",
  ".pages.dev",
  ".vercel.app",
  ".netlify.app",
];

// The original deliverable type: a public commit and a live API endpoint.
// Its shape must never change, or policies already locked on chain (job #6
// among them) would stop hashing to the value the contract holds. That is
// also why it carries no "type" field; the newer types do.
export const apiPolicySchema = z.object({
  title: z.string().trim().min(3).max(120),
  brief: z.string().trim().min(15).max(2000),
  endpointPath: z.string().regex(/^\/[a-zA-Z0-9/_-]{0,120}$/),
  expectedStatus: z.number().int().min(200).max(299),
  expectedJsonKey: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
  expectedJsonValue: z.string().max(120),
  passThreshold: z.literal(0.9),
  failThreshold: z.literal(0.1),
}).strict();

/** A live web page that must load and contain an agreed phrase. */
export const webpagePolicySchema = z.object({
  type: z.literal("webpage"),
  title: z.string().trim().min(3).max(120),
  brief: z.string().trim().min(15).max(2000),
  requiredText: z.string().trim().min(2).max(200),
  passThreshold: z.literal(0.9),
  failThreshold: z.literal(0.1),
}).strict();

/** A GitHub pull request that must be merged into the agreed repository. */
export const pullRequestPolicySchema = z.object({
  type: z.literal("pull_request"),
  title: z.string().trim().min(3).max(120),
  brief: z.string().trim().min(15).max(2000),
  repository: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, "Use owner/repository, like acme/website."),
  passThreshold: z.literal(0.9),
  failThreshold: z.literal(0.1),
}).strict();

export const digitalPolicySchema = z.union([apiPolicySchema, webpagePolicySchema, pullRequestPolicySchema]);

export type ApiPolicy = z.infer<typeof apiPolicySchema>;
export type WebpagePolicy = z.infer<typeof webpagePolicySchema>;
export type PullRequestPolicy = z.infer<typeof pullRequestPolicySchema>;
export type DigitalPolicy = z.infer<typeof digitalPolicySchema>;
export type DeliverableKind = "api" | "webpage" | "pull_request";

export function deliverableKind(policy: DigitalPolicy): DeliverableKind {
  return "type" in policy ? policy.type : "api";
}

export const apiManifestSchema = z.object({
  commitUrl: z.string().regex(
    /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/commit\/[a-fA-F0-9]{40}$/,
    "Use a full public GitHub commit URL with its 40-character SHA.",
  ),
  deploymentUrl: z.string().url().refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password &&
        !url.port && PUBLIC_DEPLOYMENT_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
    } catch {
      return false;
    }
  }, "Use a public HTTPS deployment on workers.dev, pages.dev, vercel.app, or netlify.app."),
  notes: z.string().trim().max(1000),
}).strict();

const publicHttpsUrl = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    // Proof Engine fetches this from the server, so only public HTTPS names:
    // no credentials, no custom ports, no bare IPs or local hostnames.
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      url.hostname.includes(".") && !/^[\d.]+$/.test(url.hostname) && !url.hostname.includes(":") &&
      !/(^|\.)(localhost|local|internal)$/i.test(url.hostname);
  } catch {
    return false;
  }
}, "Use a public HTTPS address.");

export const webpageManifestSchema = z.object({
  pageUrl: publicHttpsUrl,
  notes: z.string().trim().max(1000),
}).strict();

export const pullRequestManifestSchema = z.object({
  pullRequestUrl: z.string().regex(
    /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/pull\/\d{1,7}$/,
    "Use a GitHub pull request URL, like https://github.com/owner/repo/pull/42.",
  ),
  notes: z.string().trim().max(1000),
}).strict();

export const digitalManifestSchema = z.union([apiManifestSchema, webpageManifestSchema, pullRequestManifestSchema]);

export type ApiManifest = z.infer<typeof apiManifestSchema>;
export type DigitalManifest = z.infer<typeof digitalManifestSchema>;

/** Evidence must be the kind the locked policy asks for. */
export function assertManifestFits(policy: DigitalPolicy, manifest: DigitalManifest): void {
  const kind = deliverableKind(policy);
  const fits = kind === "api" ? "commitUrl" in manifest
    : kind === "webpage" ? "pageUrl" in manifest
    : "pullRequestUrl" in manifest;
  if (!fits) throw new Error("This evidence is not the kind of deliverable the job asks for.");
}

export function parseDigitalPolicy(input: unknown): DigitalPolicy {
  return digitalPolicySchema.parse(input);
}

export function parseDigitalManifest(input: unknown): DigitalManifest {
  return digitalManifestSchema.parse(input);
}

export function policyHash(policy: DigitalPolicy): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify(parseDigitalPolicy(policy))));
}

export function evidenceHash(
  jobId: string,
  lockedPolicyHash: `0x${string}`,
  manifest: DigitalManifest,
): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify({
    jobId,
    policyHash: lockedPolicyHash,
    manifest: parseDigitalManifest(manifest),
  })));
}

export function deploymentProbeUrl(policy: ApiPolicy, manifest: ApiManifest): string {
  const base = new URL(manifest.deploymentUrl);
  return new URL(policy.endpointPath, base.origin).toString();
}

export function manualVoteHash(input: {
  jobId: string;
  version: number;
  evidenceHash: `0x${string}`;
  verifier: `0x${string}`;
  pass: boolean;
  notes: string;
}): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify({
    jobId: input.jobId,
    version: input.version,
    evidenceHash: input.evidenceHash,
    verifier: input.verifier,
    pass: input.pass,
    notes: input.notes.trim(),
  })));
}
