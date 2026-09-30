"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobKind } from "@/lib/next-actions";
import { useWallet } from "./wallet-context";

/** A hiring link as the API returns it. See app/api/offers/route.ts. */
export type Offer = {
  token: string;
  kind: JobKind;
  title: string;
  status: "open" | "taken" | "created" | "withdrawn" | "expired";
  draft: Record<string, unknown>;
  clientAddress: string;
  clientTag: string | null;
  takerAddress: string | null;
  takerTag: string | null;
  jobId: string | null;
  listed: boolean;
  viewer: "public" | "client" | "taker";
  expiresAt: string;
  createdAt: string;
};

export const offerUrl = (token: string) => `${window.location.origin}/app?offer=${token}`;

async function send<T>(method: string, body: unknown): Promise<T> {
  const response = await fetch("/api/offers", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The hiring link request failed.");
  return data;
}

/** Open hiring links their clients chose to list publicly. */
export async function readBoard(): Promise<Offer[]> {
  const response = await fetch("/api/offers?board=1");
  if (!response.ok) throw new Error("The job board could not be loaded.");
  return ((await response.json()) as { offers: Offer[] }).offers;
}

/** Reads one hiring link by token; no sign-in needed to look. */
export async function readOffer(token: string): Promise<Offer> {
  const response = await fetch(`/api/offers?token=${encodeURIComponent(token)}`);
  const data = (await response.json()) as { offer?: Offer; error?: string };
  if (!response.ok || !data.offer) throw new Error(data.error ?? "This hiring link could not be opened.");
  return data.offer;
}

/** The signed-in person's hiring links, plus the actions on them. */
export function useOffers() {
  const wallet = useWallet();
  const { wallet: connected, proveParticipation } = wallet;
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connected) return setOffers([]);
    setLoading(true);
    try {
      const proofs = await proveParticipation();
      const response = await fetch(`/api/offers?proofs=${encodeURIComponent(JSON.stringify(proofs))}`);
      if (response.ok) setOffers(((await response.json()) as { offers: Offer[] }).offers);
    } finally {
      setLoading(false);
    }
    // Narrower than [wallet] on purpose; see the note in use-live-agreements.ts.
  }, [connected, proveParticipation]);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  const create = useCallback(async (kind: JobKind, title: string, draft: Record<string, unknown>, listed = false) => {
    const proofs = await proveParticipation();
    const created = await send<{ token: string }>("POST", { kind, title, draft, listed, proofs });
    await refresh();
    return created.token;
  }, [proveParticipation, refresh]);

  const take = useCallback(async (token: string) => {
    const proofs = await proveParticipation();
    const { offer } = await send<{ offer: Offer }>("PUT", { token, proofs });
    await refresh();
    return offer;
  }, [proveParticipation, refresh]);

  const update = useCallback(async (token: string, action: "created" | "withdraw" | "reopen", jobId?: string) => {
    const proofs = await proveParticipation();
    await send("PATCH", { token, proofs, action, ...(jobId ? { jobId } : {}) });
    await refresh();
  }, [proveParticipation, refresh]);

  return { offers, loading, refresh, create, take, update };
}
