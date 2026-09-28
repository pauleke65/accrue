import { keccak256, stringToHex } from "viem";
import { z } from "zod";

const PUBLIC_DEPLOYMENT_SUFFIXES = [
  ".workers.dev",
  ".pages.dev",
  ".vercel.app",
  ".netlify.app",
];

export const digitalPolicySchema = z.object({
  title: z.string().trim().min(3).max(120),
  brief: z.string().trim().min(15).max(2000),
  endpointPath: z.string().regex(/^\/[a-zA-Z0-9/_-]{0,120}$/),
  expectedStatus: z.number().int().min(200).max(299),
  expectedJsonKey: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
  expectedJsonValue: z.string().max(120),
  passThreshold: z.literal(0.9),
  failThreshold: z.literal(0.1),
}).strict();

export type DigitalPolicy = z.infer<typeof digitalPolicySchema>;

export const digitalManifestSchema = z.object({
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

export type DigitalManifest = z.infer<typeof digitalManifestSchema>;

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

export function deploymentProbeUrl(policy: DigitalPolicy, manifest: DigitalManifest): string {
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
