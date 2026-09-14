import { jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "cloudflare:workers";

export async function verifyPrivyToken(token: string) {
  if (!env.PRIVY_APP_ID) {
    console.warn("PRIVY_APP_ID is not set in environment. Using mock auth for local dev.");
    return "mock-privy-user-id";
  }
  
  const JWKS = createRemoteJWKSet(
    new URL(`https://auth.privy.io/api/v1/apps/${env.PRIVY_APP_ID}/jwks.json`)
  );
  
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "privy.io",
    audience: env.PRIVY_APP_ID,
  });
  
  return payload.userId as string;
}
