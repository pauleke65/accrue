"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LocalAccount } from "viem";
import {
  createWallet,
  openWallet,
  forgetCredential,
  passkeysAvailable,
  ROLES,
  type Role,
  type Wallet,
} from "@/lib/mera-account";
import { readBalance, readGasBalance, readableError } from "@/lib/ausd";

/**
 * The passkey account, shared by the whole application rather than owned by
 * one screen. Signing in once yields an account for each role, so the person
 * demonstrating an agreement holds three distinct addresses from a single
 * passkey — the roles are separate accounts, not a pretend switch.
 */

export type TagRecord = { tag: string; displayName: string } | null;

type WalletState = {
  available: boolean;
  wallet: Wallet | null;
  connecting: boolean;
  error: string;
  setError: (value: string) => void;
  role: Role;
  setRole: (role: Role) => void;
  address: `0x${string}` | null;
  account: LocalAccount | null;
  balances: Record<Role, bigint | null>;
  gas: Record<Role, bigint | null>;
  tags: Record<Role, TagRecord>;
  remaining: number;
  connect: (mode: "create" | "open") => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  claimTag: (tag: string, displayName: string) => Promise<void>;
  /** Asks the sponsor to cover this role's first network fees. */
  ensureGas: () => Promise<void>;
  /** Claims test tokens through the sponsor, so no gas is needed first. */
  sponsorTokens: () => Promise<void>;
  resolveTag: (
    tag: string,
  ) => Promise<{ address: `0x${string}`; displayName: string } | null>;
};

const Context = createContext<WalletState | null>(null);

const emptyByRole = <T,>(value: T) =>
  Object.fromEntries(ROLES.map((r) => [r, value])) as Record<Role, T>;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<Role>("payer");
  const [balances, setBalances] = useState(emptyByRole<bigint | null>(null));
  const [gas, setGas] = useState(emptyByRole<bigint | null>(null));
  const [tags, setTags] = useState(emptyByRole<TagRecord>(null));
  const [remaining, setRemaining] = useState(0);
  const walletRef = useRef<Wallet | null>(null);

  // Passkey support cannot be known while rendering on the server, and
  // guessing makes the first client render disagree with the server's HTML.
  // It is resolved after mount instead, so both agree on "unknown" first.
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(passkeysAvailable()), []);

  const loadFor = useCallback(async (current: Wallet) => {
    try {
      const entries = await Promise.all(
        ROLES.map(async (r) => {
          const address = current.addresses[r];
          const [ausd, fee, tag] = await Promise.all([
            readBalance(address),
            readGasBalance(address),
            fetch(`/api/tags?address=${address}`)
              .then((res) =>
                res.ok
                  ? (res.json() as Promise<{
                      found?: boolean;
                      tag?: string;
                      displayName?: string;
                    }>)
                  : null,
              )
              .catch(() => null),
          ]);
          return [r, ausd, fee, tag] as const;
        }),
      );
      setBalances(
        Object.fromEntries(entries.map(([r, a]) => [r, a])) as Record<
          Role,
          bigint
        >,
      );
      setGas(
        Object.fromEntries(entries.map(([r, , f]) => [r, f])) as Record<
          Role,
          bigint
        >,
      );
      setTags(
        Object.fromEntries(
          entries.map(([r, , , t]) => [
            r,
            t?.found && t.tag
              ? { tag: t.tag, displayName: t.displayName ?? t.tag }
              : null,
          ]),
        ) as Record<Role, TagRecord>,
      );
    } catch (cause) {
      setError(readableError(cause));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (walletRef.current) await loadFor(walletRef.current);
  }, [loadFor]);

  const connect = useCallback(
    async (mode: "create" | "open") => {
      setConnecting(true);
      setError("");
      try {
        const next =
          mode === "create"
            ? await createWallet("Accrue account")
            : await openWallet();
        walletRef.current?.end();
        walletRef.current = next;
        setWallet(next);
        setBalances(emptyByRole<bigint | null>(null));
        await loadFor(next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Sign-in failed.");
      } finally {
        setConnecting(false);
      }
    },
    [loadFor],
  );

  const disconnect = useCallback(() => {
    walletRef.current?.end();
    walletRef.current = null;
    setWallet(null);
    setBalances(emptyByRole<bigint | null>(null));
    setGas(emptyByRole<bigint | null>(null));
    setTags(emptyByRole<TagRecord>(null));
    forgetCredential();
  }, []);

  // The session is bounded. Showing the countdown is the difference between a
  // signature that stops working for a reason and one that simply fails.
  useEffect(() => {
    if (!wallet) return;
    const tick = () => {
      const left = Math.max(0, wallet.expiresAt - Date.now());
      setRemaining(left);
      if (left === 0) disconnect();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [wallet, disconnect]);

  useEffect(() => () => walletRef.current?.end(), []);

  /**
   * Claiming a tag means signing the claim with the account it points at, so
   * the directory cannot be made to point a name at somebody else's account.
   */
  const claimTag = useCallback(
    async (tag: string, displayName: string) => {
      const current = walletRef.current;
      if (!current) throw new Error("Sign in first.");
      const clean = tag.toLowerCase().replace(/^@/, "").trim();
      const address = current.addresses[role];
      const signature = await current.accounts[role].signMessage({
        message: `Accrue: claim the tag @${clean} for ${address}`,
      });
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag: clean,
          address,
          displayName,
          signature,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not claim");
      await refresh();
    },
    [role, refresh],
  );

  /**
   * A brand-new account holds no MON, so it can neither claim test tokens nor
   * send. Rather than sending someone off to find a gas faucet, the sponsor
   * covers the first fees. The server decides whether the grant is warranted.
   */
  const sponsor = useCallback(
    async (action: "gas" | "tokens", address: `0x${string}`) => {
      const response = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, action }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error ?? "Sponsored gas is unavailable.");
    },
    [],
  );

  const ensureGas = useCallback(async () => {
    const current = walletRef.current;
    if (!current) return;
    await sponsor("gas", current.addresses[role]);
    await refresh();
  }, [role, sponsor, refresh]);

  const sponsorTokens = useCallback(async () => {
    const current = walletRef.current;
    if (!current) return;
    await sponsor("tokens", current.addresses[role]);
    await refresh();
  }, [role, sponsor, refresh]);

  const resolveTag = useCallback(async (tag: string) => {
    const clean = tag.toLowerCase().replace(/^@/, "").trim();
    const response = await fetch(`/api/tags?tag=${encodeURIComponent(clean)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      found: boolean;
      address?: `0x${string}`;
      displayName?: string;
    };
    return data.found && data.address
      ? { address: data.address, displayName: data.displayName ?? clean }
      : null;
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      available,
      wallet,
      connecting,
      error,
      setError,
      role,
      setRole,
      address: wallet?.addresses[role] ?? null,
      account: wallet?.accounts[role] ?? null,
      balances,
      gas,
      tags,
      remaining,
      connect,
      disconnect,
      refresh,
      claimTag,
      ensureGas,
      sponsorTokens,
      resolveTag,
    }),
    [
      available,
      wallet,
      connecting,
      error,
      role,
      balances,
      gas,
      tags,
      remaining,
      connect,
      disconnect,
      refresh,
      claimTag,
      ensureGas,
      sponsorTokens,
      resolveTag,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWallet(): WalletState {
  const value = useContext(Context);
  if (!value) throw new Error("useWallet must be used inside a WalletProvider");
  return value;
}
