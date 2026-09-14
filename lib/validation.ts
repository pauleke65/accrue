import { z } from "zod";
const words = z.string().trim().min(1).max(200);
export const draftSchema = z
  .object({
    title: words,
    scope: z.string().trim().min(10).max(4000),
    earner: z.string().email("Must be a valid email address").max(200),
    verifier: z.union([z.string().email("Must be a valid email address").max(200), z.literal("")]).optional(),
    expiry: z.string().datetime(),
    milestones: z
      .array(
        z.object({
          title: words,
          criteria: z.string().trim().min(10).max(2000),
          amount: z.number().int().min(1).max(100000000),
          fee: z.number().int().min(0).max(10000000),
          approver: z.enum(["payer", "verifier"]),
        }),
      )
      .min(1)
      .max(12),
  })
  .refine(
    (d) =>
      !d.milestones.some((m) => m.approver === "verifier") ||
      (d.verifier && d.verifier.length > 0),
    { message: "An email for the agreed verifier is required if verifier approval is used." },
  );
export const actionSchema = z.object({
  type: z.enum([
    "accept",
    "fund",
    "submit",
    "approve",
    "changes",
    "withdraw",
    "refund",
    "cancel",
    "correct",
  ]),
  role: z.enum(["payer", "earner", "verifier"]),
  operationId: z.string().uuid(),
  version: z.number().int().positive(),
  milestone: z.number().int().min(0).max(11).optional(),
  notes: z.string().trim().max(6000).optional(),
  files: z.array(z.string().uuid()).max(5).optional(),
  digest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export async function sha256(value: string | ArrayBuffer) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof value === "string" ? new TextEncoder().encode(value) : value,
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
