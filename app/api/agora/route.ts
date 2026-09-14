import { env } from "cloudflare:workers";
import { authorize, failure, HttpError } from "@/lib/server";
import { token } from "@/lib/chain";

/**
 * Agora's public API.
 *
 * Two different things live behind one endpoint, because they answer to two
 * different levels of access.
 *
 * Supply metrics are open — no key, no account — and they are what let the app
 * say what AUSD actually is rather than asserting it. Cash-out is the Routes
 * API: a route is a reusable path from one currency to an account, so
 * `ausd → usd` is a redemption that pays a verified bank account. That needs an
 * organisation key, registered accounts and approved wallet entitlements, none
 * of which can be self-served, so it is built and reports itself unconfigured
 * rather than pretending.
 *
 * Documented at https://docs.agora.finance/api — base https://api.agora.finance.
 */

const BASE = "https://api.agora.finance";

/** Monad's CAIP-2 identifier in Agora's metrics response. */
const MONAD_CHAIN = "eip155:143";

type Metrics = {
  circulatingSupply: string;
  totalSupply: string;
  partial: boolean;
  chains: {
    chainId: string;
    network: string;
    circulatingSupply: string;
    totalSupply: string;
  }[];
};

function apiKey(): string | null {
  const value = (env as Record<string, unknown>).AGORA_API_KEY;
  return typeof value === "string" && value.length > 8 ? value : null;
}

/**
 * Keys are long-lived; the session they buy is not. Exchanging on demand keeps
 * the key itself out of every downstream request.
 */
async function session(key: string): Promise<string> {
  const response = await fetch(`${BASE}/v0/auth/token`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
  });
  if (!response.ok)
    throw new HttpError(
      502,
      `Agora refused the API key (${response.status}). Check it is current and carries the roles the integration needs.`,
    );
  const data = (await response.json()) as { token?: string; jwt?: string };
  const jwt = data.token ?? data.jwt;
  if (!jwt) throw new HttpError(502, "Agora returned no session token.");
  return jwt;
}

export async function GET(request: Request) {
  try {
    await authorize();
    const what = new URL(request.url).searchParams.get("what") ?? "supply";

    if (what === "supply") {
      // Open endpoint: this works on every deployment, with or without a key.
      const response = await fetch(`${BASE}/v0/metrics`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok)
        throw new HttpError(502, "Agora's metrics are unavailable right now.");
      const metrics = (await response.json()) as Metrics;
      const monad = metrics.chains.find((c) => c.chainId === MONAD_CHAIN);

      return Response.json(
        {
          source: "Agora public API",
          symbol: token.symbol,
          // Decimal strings throughout: these amounts do not survive a float.
          total: metrics.totalSupply,
          circulating: metrics.circulatingSupply,
          partial: metrics.partial,
          monad: monad
            ? {
                circulating: monad.circulatingSupply,
                total: monad.totalSupply,
              }
            : null,
          chains: metrics.chains.length,
        },
        { headers: { "Cache-Control": "public, max-age=300" } },
      );
    }

    if (what === "cashout") {
      const key = apiKey();
      if (!key)
        return Response.json({
          configured: false,
          reason:
            "Cash-out needs an Agora organisation key, a verified bank account and an approved wallet entitlement. None of those can be self-served, so redemption is described here rather than offered.",
          documented:
            "https://docs.agora.finance/api/endpoints/routes/overview",
        });

      const jwt = await session(key);
      // A route is reusable and carries no amount: every matching transfer
      // settles on its own, which is why the instructions can be shown once
      // and kept.
      const response = await fetch(
        `${BASE}/v0/routes?fromCurrency=ausd&toCurrency=usd`,
        {
          headers: {
            authorization: `Bearer ${jwt}`,
            accept: "application/json",
          },
        },
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new HttpError(
          502,
          `Agora refused the routes request: ${detail.slice(0, 160)}`,
        );
      }
      const routes = await response.json();
      return Response.json({ configured: true, routes });
    }

    throw new HttpError(400, "Ask for supply or cashout.");
  } catch (error) {
    return failure(error);
  }
}
