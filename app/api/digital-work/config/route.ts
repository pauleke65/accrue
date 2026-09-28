import { env } from "cloudflare:workers";
import { privateKeyToAccount } from "viem/accounts";
import { digitalWorkAddress } from "@/lib/digital-work-chain";

export async function GET() {
  const key = env.ACCRUE_JEV_VERIFIER_KEY;
  const jevAddress = key && /^0x[a-fA-F0-9]{64}$/.test(key)
    ? privateKeyToAccount(key as `0x${string}`).address
    : null;
  return Response.json({
    contractAddress: digitalWorkAddress(),
    jevAddress,
    modelReady: Boolean(env.ACCRUE_BEATAPI_API_KEY || env.AI ||
      (env.ACCRUE_CLOUDFLARE_ACCOUNT_ID && env.ACCRUE_CLOUDFLARE_AI_TOKEN)),
    model: env.ACCRUE_BEATAPI_API_KEY ? "jev-1.13-free" : "typesafe/jev",
    provider: env.ACCRUE_BEATAPI_API_KEY ? "BeatAPI" : "Cloudflare AI",
  }, { headers: { "Cache-Control": "no-store" } });
}
