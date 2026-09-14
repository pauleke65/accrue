"use client";
import { useCallback, useEffect, useState } from "react";
import type { LocalAccount } from "viem";
import {
  callEscrow,
  approveDeposit,
  readAgreement,
  readMilestones,
  readCreatedId,
  readAllowance,
  hashText,
  MilestoneState,
  type OnChainAgreement,
} from "@/lib/escrow";
import {
  escrow,
  network,
  parseAmount,
  type TransactionState,
} from "@/lib/chain";
import { useWallet } from "./wallet-context";
import type { Role } from "@/lib/mera-account";

/**
 * Milestone agreements whose money is real.
 *
 * The contract is the authority on every figure: what was deposited, what is
 * still reserved, what has been earned and what has been withdrawn are read
 * from it on each load. The server holds only the readable terms the contract
 * stores as hashes. Nothing financial is cached, so the two cannot disagree.
 */

export type LiveMilestone = {
  title: string;
  criteria: string;
  criteriaHash: `0x${string}`;
  workerAmount: string;
  verifierFee: string;
};

export type LiveTerms = {
  id: string;
  chainId: number;
  escrow: `0x${string}`;
  onchainId: string;
  title: string;
  scope: string;
  payer: `0x${string}`;
  worker: `0x${string}`;
  verifier: `0x${string}`;
  workerTag: string | null;
  verifierTag: string | null;
  milestones: LiveMilestone[];
  createdAt: string;
};

export type LiveAgreement = LiveTerms & {
  chain: OnChainAgreement;
  states: number[];
  evidence: `0x${string}`[];
};

export type Draft = {
  title: string;
  scope: string;
  workerTag: string;
  verifierTag: string;
  days: number;
  milestones: {
    title: string;
    criteria: string;
    amount: string;
    fee: string;
  }[];
};

/** Which role a given address plays, if any. */
export function roleOf(
  agreement: LiveAgreement,
  address: string | null,
): Role | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  if (agreement.payer.toLowerCase() === lower) return "payer";
  if (agreement.worker.toLowerCase() === lower) return "worker";
  if (agreement.verifier.toLowerCase() === lower) return "verifier";
  return null;
}

const ACCEPT_BIT: Record<Role, number> = { payer: 1, worker: 2, verifier: 4 };
const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;

export function hasAccepted(agreement: LiveAgreement, role: Role): boolean {
  return (agreement.chain.acceptances & ACCEPT_BIT[role]) !== 0;
}

/**
 * Which acceptances the contract actually requires before it will fund —
 * mirrors `requiredMask` in AccrueEscrow.sol exactly. A job with no verifier
 * never asks the verifier bit to be set; one with a verifier needs all three.
 * Getting this wrong client-side does not change what the contract enforces,
 * but it does decide whether the person clicking Fund finds out from a clear
 * message or from a reverted transaction.
 */
export function requiredAcceptances(agreement: LiveAgreement): Role[] {
  const roles: Role[] = ["payer", "worker"];
  if (agreement.chain.verifier.toLowerCase() !== ZERO_ADDRESS)
    roles.push("verifier");
  return roles;
}

export function readyToFund(agreement: LiveAgreement): boolean {
  return requiredAcceptances(agreement).every((role) =>
    hasAccepted(agreement, role),
  );
}

export function useLiveAgreements() {
  const w = useWallet();
  const [terms, setTerms] = useState<LiveTerms[]>([]);
  const [agreements, setAgreements] = useState<LiveAgreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<TransactionState>({
    status: "idle",
  });

  const loadTerms = useCallback(async () => {
    try {
      const response = await fetch("/api/live-agreements");
      if (!response.ok) return;
      const data = (await response.json()) as { agreements: LiveTerms[] };
      setTerms(data.agreements);
    } catch {
      setError("Could not load your agreements.");
    }
  }, []);

  /** Reads the money from the chain for every agreement the app knows about. */
  const hydrate = useCallback(async (list: LiveTerms[]) => {
    setLoading(true);
    try {
      const full = await Promise.all(
        list.map(async (t) => {
          const [chain, milestones] = await Promise.all([
            readAgreement(BigInt(t.onchainId)),
            readMilestones(BigInt(t.onchainId)) as Promise<
              { state: number; evidenceHash: `0x${string}` }[]
            >,
          ]);
          return {
            ...t,
            chain,
            states: milestones.map((m) => m.state),
            evidence: milestones.map((m) => m.evidenceHash),
          };
        }),
      );
      setAgreements(full);
    } catch {
      setError("Could not read the agreements from the network.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  useEffect(() => {
    if (terms.length) void hydrate(terms);
    else setAgreements([]);
  }, [terms, hydrate]);

  const refresh = useCallback(async () => {
    await loadTerms();
  }, [loadTerms]);

  const run = useCallback(
    async <T>(
      work: (account: LocalAccount) => Promise<T>,
    ): Promise<T | null> => {
      if (!w.account) {
        setError("Sign in with your passkey first.");
        return null;
      }
      setBusy(true);
      setError("");
      try {
        // Every action costs a fee, and a role's account may never have paid
        // one before; cover it before asking for a signature.
        if (w.gas[w.role] === 0n) await w.ensureGas();
        return await work(w.account);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That did not work.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [w],
  );

  /**
   * Creates the agreement on chain, then records the readable terms. The
   * contract is written first: if the second step fails the money is still
   * governed correctly, and the text can be restored, which is the safer way
   * round.
   */
  const create = useCallback(
    async (draft: Draft) => {
      return run(async (account) => {
        const worker = await w.resolveTag(draft.workerTag);
        if (!worker)
          throw new Error(`No account answers to @${draft.workerTag}.`);
        const verifier = draft.verifierTag.trim()
          ? await w.resolveTag(draft.verifierTag)
          : null;
        if (draft.verifierTag.trim() && !verifier)
          throw new Error(`No account answers to @${draft.verifierTag}.`);

        const scopeHash = hashText(draft.scope);
        const expiry = BigInt(
          Math.floor(Date.now() / 1000) + draft.days * 86_400,
        );
        const milestones = draft.milestones.map((m) => ({
          workerAmount: parseAmount(m.amount),
          verifierFee: verifier ? parseAmount(m.fee || "0") : 0n,
          externalVerifier: Boolean(verifier),
          criteriaHash: hashText(m.criteria),
        }));

        const state = await callEscrow({
          account,
          functionName: "create",
          args: [
            worker.address,
            verifier ? verifier.address : `0x${"0".repeat(40)}`,
            expiry,
            scopeHash,
            milestones,
          ],
          report: setProgress,
        });
        if (state.status !== "confirmed" || !state.hash)
          throw new Error(state.error ?? "The agreement was not created.");

        // The id the transaction actually produced, not a guess made before
        // it was submitted — see readCreatedId for why that distinction
        // matters on a contract other things can also be writing to.
        const createdId = await readCreatedId(state.hash);

        await fetch("/api/live-agreements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainId: network.chainId,
            escrow: escrow.address,
            onchainId: createdId.toString(),
            title: draft.title,
            scope: draft.scope,
            payer: account.address,
            worker: worker.address,
            verifier: verifier ? verifier.address : account.address,
            workerTag: draft.workerTag.replace(/^@/, ""),
            verifierTag: draft.verifierTag.replace(/^@/, "") || null,
            milestones: draft.milestones.map((m, i) => ({
              title: m.title,
              criteria: m.criteria,
              criteriaHash: milestones[i].criteriaHash,
              workerAmount: milestones[i].workerAmount.toString(),
              verifierFee: milestones[i].verifierFee.toString(),
            })),
          }),
        });
        await refresh();
        return createdId;
      });
    },
    [run, w, refresh],
  );

  const accept = useCallback(
    async (agreement: LiveAgreement) =>
      run(async (account) => {
        const state = await callEscrow({
          account,
          functionName: "accept",
          args: [BigInt(agreement.onchainId), agreement.chain.termsHash],
          report: setProgress,
        });
        if (state.status !== "confirmed")
          throw new Error(state.error ?? "Acceptance did not go through.");
        await refresh();
      }),
    [run, refresh],
  );

  /** Funding needs an allowance for exactly the deposit, never more. */
  const fund = useCallback(
    async (agreement: LiveAgreement) =>
      run(async (account) => {
        // The contract requires every named party to have accepted before it
        // will fund, and checking that here means a stale click fails with a
        // sentence rather than a reverted transaction and a raw RPC message.
        const missing = requiredAcceptances(agreement).filter(
          (role) => !hasAccepted(agreement, role),
        );
        if (missing.length)
          throw new Error(
            `Waiting on ${missing.join(" and ")} to accept before this can be funded.`,
          );
        const deposit = agreement.chain.deposit;
        const allowance = await readAllowance(account.address);
        if (allowance < deposit)
          await approveDeposit({
            account,
            amount: deposit,
            report: setProgress,
          });
        const state = await callEscrow({
          account,
          functionName: "fund",
          args: [BigInt(agreement.onchainId)],
          report: setProgress,
        });
        if (state.status !== "confirmed")
          throw new Error(state.error ?? "Funding did not go through.");
        await w.refresh();
        await refresh();
      }),
    [run, refresh, w],
  );

  const submit = useCallback(
    async (agreement: LiveAgreement, index: number, notes: string) =>
      run(async (account) => {
        const state = await callEscrow({
          account,
          functionName: "submitEvidence",
          args: [BigInt(agreement.onchainId), BigInt(index), hashText(notes)],
          report: setProgress,
        });
        if (state.status !== "confirmed")
          throw new Error(state.error ?? "The submission did not go through.");
        await refresh();
      }),
    [run, refresh],
  );

  const approve = useCallback(
    async (agreement: LiveAgreement, index: number) =>
      run(async (account) => {
        const state = await callEscrow({
          account,
          functionName: "approve",
          args: [
            BigInt(agreement.onchainId),
            BigInt(index),
            agreement.evidence[index],
          ],
          report: setProgress,
        });
        if (state.status !== "confirmed")
          throw new Error(state.error ?? "The approval did not go through.");
        await w.refresh();
        await refresh();
      }),
    [run, refresh, w],
  );

  const withdraw = useCallback(
    async (agreement: LiveAgreement) =>
      run(async (account) => {
        const state = await callEscrow({
          account,
          functionName: "withdraw",
          args: [BigInt(agreement.onchainId)],
          report: setProgress,
        });
        if (state.status !== "confirmed")
          throw new Error(state.error ?? "The withdrawal did not go through.");
        await w.refresh();
        await refresh();
      }),
    [run, refresh, w],
  );

  return {
    agreements,
    loading,
    busy,
    error,
    setError,
    progress,
    refresh,
    create,
    accept,
    fund,
    submit,
    approve,
    withdraw,
    MilestoneState,
  };
}
