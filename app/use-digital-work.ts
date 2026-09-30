"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress, isAddress, type LocalAccount } from "viem";
import { GAS_TOPUP_THRESHOLD, parseAmount, token, type TransactionState } from "@/lib/chain";
import {
  digitalWorkAddress,
  ensureDigitalAllowance,
  readDigitalClaimable,
  readDigitalCreatedId,
  readDigitalJob,
  readDigitalVote,
  readDigitalRulesVersion,
  readCancelConsents,
  sendDigitalAction,
  type DigitalJobOnChain,
} from "@/lib/digital-work-chain";
import { contractOfJobId, digitalJobId, digitalWriteMessage } from "@/lib/digital-work-id";
import {
  evidenceHash,
  manualVoteHash,
  parseDigitalManifest,
  parseDigitalPolicy,
  policyHash,
  type DigitalManifest,
  type DigitalPolicy,
} from "@/lib/digital-work-policy";
import { useWallet } from "./wallet-context";
import type { CheckReport } from "@/lib/proof-checks";

export type DigitalTerms = {
  id: string;
  onchainId: string;
  title: string;
  policy: DigitalPolicy;
  policyHash: `0x${string}`;
  payer: `0x${string}`;
  worker: `0x${string}`;
  verifiers: [`0x${string}`, `0x${string}`, `0x${string}`];
  createdAt: string;
};

export type DigitalJob = DigitalTerms & {
  chain: DigitalJobOnChain;
  /** The deployment this job lives on (read from its id). */
  contract: `0x${string}`;
  /** 1 for the original rules; 2 adds pay-on-silence and cancellation. */
  rules: number;
  /** Version 2: bit 1 the client, bit 2 the worker has agreed to cancel. */
  cancelConsents: number;
};

export type DigitalConfig = {
  contractAddress: `0x${string}` | null;
  jevAddress: `0x${string}` | null;
  modelReady: boolean;
  model: string;
  provider: string;
};

export type DigitalDraft = {
  policy: DigitalPolicy;
  worker: string;
  reviewerB: string;
  reviewerC: string;
  reward: string;
  verifierFees: string;
  deliveryHours: number;
  reviewHours: number;
};

export type DigitalSubmission = {
  version: number;
  evidenceHash: `0x${string}`;
  manifest: DigitalManifest;
  createdAt: string;
};

export type DigitalRun = {
  version: number;
  state: string;
  report: {
    checks: CheckReport;
    jev: { model: string; requirementsProbability: number; reviewProbability: number; recommendation: string };
  } | null;
  reportHash: `0x${string}` | null;
  voteTx: `0x${string}` | null;
  updatedAt: string;
};

export type DigitalManualVote = {
  version: number;
  verifier: `0x${string}`;
  pass: boolean;
  notes: string;
  reportHash: `0x${string}`;
  createdAt: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The digital-work request failed.");
  return data;
}

export function useDigitalWork() {
  const wallet = useWallet();
  const connectedWallet = wallet.wallet;
  const currentAddress = wallet.address;
  const proveParticipation = wallet.proveParticipation;
  const [config, setConfig] = useState<DigitalConfig | null>(null);
  const [jobs, setJobs] = useState<DigitalJob[]>([]);
  const [claimable, setClaimable] = useState(0n);
  const [claimableBy, setClaimableBy] = useState<{ at: `0x${string}`; amount: bigint }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<TransactionState>({ status: "idle" });

  useEffect(() => {
    void fetch("/api/digital-work/config")
      .then((response) => response.json() as Promise<DigitalConfig>)
      .then(setConfig)
      .catch(() => setError("Could not read digital-work configuration."));
  }, []);

  const refresh = useCallback(async () => {
    if (!connectedWallet || !digitalWorkAddress()) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const proofs = await proveParticipation();
      const query = encodeURIComponent(JSON.stringify(proofs));
      const response = await fetch(`/api/digital-work/jobs?proofs=${query}`);
      if (!response.ok) throw new Error("Could not load digital jobs.");
      const data = await response.json() as { jobs: DigitalTerms[] };
      const hydrated = await Promise.all(data.jobs.map(async (terms) => {
        const contract = contractOfJobId(terms.id);
        const [chain, rules, cancelConsents] = await Promise.all([
          readDigitalJob(BigInt(terms.onchainId), contract),
          readDigitalRulesVersion(contract),
          readCancelConsents(BigInt(terms.onchainId), contract),
        ]);
        return { ...terms, chain, contract, rules, cancelConsents };
      }));
      setJobs(hydrated);
      // Each deployment keeps its own balance; add up every one this person
      // has a job on, plus the current one.
      if (currentAddress) {
        const contracts = [...new Set([digitalWorkAddress()!, ...hydrated.map((j) => j.contract)].map((a) => a.toLowerCase()))];
        const balances = await Promise.all(contracts.map(async (at) => ({
          at: at as `0x${string}`, amount: await readDigitalClaimable(currentAddress, at as `0x${string}`).catch(() => 0n),
        })));
        setClaimableBy(balances.filter((b) => b.amount > 0n));
        setClaimable(balances.reduce((sum, b) => sum + b.amount, 0n));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load digital jobs.");
    } finally {
      setLoading(false);
    }
  }, [connectedWallet, currentAddress, proveParticipation]);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  const run = useCallback(async <T>(work: (account: LocalAccount) => Promise<T>): Promise<T | null> => {
    if (!wallet.account) {
      setError("Sign in with a passkey first.");
      return null;
    }
    setBusy(true);
    setError("");
    try {
      if (wallet.gas[wallet.role] !== null && wallet.gas[wallet.role]! < GAS_TOPUP_THRESHOLD)
        await wallet.ensureGas();
      return await work(wallet.account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [wallet]);

  const resolve = useCallback(async (value: string): Promise<`0x${string}`> => {
    if (isAddress(value)) return getAddress(value);
    const found = await wallet.resolveTag(value);
    if (!found) throw new Error(`No account answers to ${value}.`);
    return found.address;
  }, [wallet]);

  const create = useCallback((draft: DigitalDraft) => run(async (account) => {
    if (!config?.jevAddress) throw new Error("Proof Engine needs a configured automated verifier before you can create an agreement.");
    const policy = parseDigitalPolicy(draft.policy);
    const worker = await resolve(draft.worker);
    const reviewerB = await resolve(draft.reviewerB);
    const reviewerC = await resolve(draft.reviewerC);
    const reward = parseAmount(draft.reward);
    const feePool = parseAmount(draft.verifierFees);
    if (reward <= 0n || feePool < 3n) throw new Error("Enter a reward and verifier fee pool.");
    const now = Math.floor(Date.now() / 1000);
    const delivery = BigInt(now + draft.deliveryHours * 3600);
    const review = delivery + BigInt(draft.reviewHours * 3600);
    const digest = policyHash(policy);
    const transaction = await sendDigitalAction({
      account, functionName: "create",
      args: [worker, [config.jevAddress, reviewerB, reviewerC], reward, feePool, delivery, review, digest],
      report: setProgress,
    });
    if (transaction.status !== "confirmed" || !transaction.hash)
      throw new Error(transaction.error ?? "Job creation did not confirm.");
    const onchainId = (await readDigitalCreatedId(transaction.hash)).toString();
    const id = digitalJobId(onchainId);
    const signature = await account.signMessage({ message: digitalWriteMessage("create", id, digest) });
    await postJson("/api/digital-work/jobs", { onchainId, policy, payer: account.address, signature });
    await refresh();
    return onchainId;
  }), [config, resolve, run, refresh]);

  const act = useCallback((job: DigitalJob, functionName: string, args: readonly unknown[]) => run(async (account) => {
    const transaction = await sendDigitalAction({ account, functionName, args, report: setProgress, at: job.contract });
    if (transaction.status !== "confirmed") throw new Error(transaction.error ?? "Transaction did not confirm.");
    await refresh();
    return transaction.hash;
  }), [run, refresh]);

  const accept = (job: DigitalJob) => act(job, "accept", [BigInt(job.onchainId), job.policyHash]);
  const fund = (job: DigitalJob) => run(async (account) => {
    await ensureDigitalAllowance(account, job.chain.reward + job.chain.feePool, setProgress, job.contract);
    const transaction = await sendDigitalAction({
      account, functionName: "fund", args: [BigInt(job.onchainId)], report: setProgress, at: job.contract,
    });
    if (transaction.status !== "confirmed") throw new Error(transaction.error ?? "Funding did not confirm.");
    await wallet.refresh();
    await refresh();
  });

  /** Asks the server to run Proof Engine on one evidence version. */
  const runReview = useCallback(async (onchainId: string, version: number, contract: string) => {
    const proofs = await proveParticipation();
    return postJson("/api/digital-work/verify", { onchainId, contract, version, proofs });
  }, [proveParticipation]);

  const submit = (job: DigitalJob, raw: DigitalManifest) => run(async (account) => {
    const manifest = parseDigitalManifest(raw);
    const digest = evidenceHash(job.id, job.policyHash, manifest);
    const transaction = await sendDigitalAction({
      account, functionName: "submit", args: [BigInt(job.onchainId), digest], report: setProgress, at: job.contract,
    });
    if (transaction.status !== "confirmed") throw new Error(transaction.error ?? "Evidence was not submitted.");
    const version = (await readDigitalJob(BigInt(job.onchainId), job.contract)).version;
    const signature = await account.signMessage({ message: digitalWriteMessage("submit", job.id, digest) });
    await postJson("/api/digital-work/submissions", {
      onchainId: job.onchainId, contract: job.contract, version, manifest, worker: account.address, signature,
    });
    // Start Proof Engine straight away rather than waiting for someone to
    // find a button. The submission already stands if this part fails (an AI
    // rate limit, say); the job page retries when a participant opens it.
    try {
      await runReview(job.onchainId, version, job.contract);
      setNotice("Evidence submitted. Proof Engine has reviewed it.");
    } catch (cause) {
      setNotice(`Evidence submitted. Proof Engine will retry: ${cause instanceof Error ? cause.message : "review did not start"}`);
    }
    await refresh();
  });


  const verify = (job: DigitalJob) => run(async () => {
    const result = await runReview(job.onchainId, job.chain.version, job.contract);
    await refresh();
    return result;
  });

  const vote = (job: DigitalJob, pass: boolean, notes: string) => run(async (account) => {
    if (notes.trim().length < 3) throw new Error("Write a brief reason for your vote.");
    const current = await readDigitalVote(BigInt(job.onchainId), account.address, job.contract);
    const reportHash = manualVoteHash({
      jobId: job.id, version: job.chain.version, evidenceHash: job.chain.evidenceHash,
      verifier: account.address, pass, notes: notes.trim(),
    });
    if (current.version === job.chain.version) {
      if (current.reportHash.toLowerCase() !== reportHash.toLowerCase())
        throw new Error("You already voted with a different review on this version.");
    } else {
      const transaction = await sendDigitalAction({
        account, functionName: "vote",
        args: [BigInt(job.onchainId), job.chain.evidenceHash, pass, reportHash],
        report: setProgress,
        at: job.contract,
      });
      if (transaction.status !== "confirmed") throw new Error(transaction.error ?? "Vote did not confirm.");
    }
    const signature = await account.signMessage({ message: digitalWriteMessage("vote", job.id, reportHash) });
    await postJson("/api/digital-work/manual-votes", {
      onchainId: job.onchainId, contract: job.contract, version: job.chain.version, evidenceHash: job.chain.evidenceHash,
      verifier: account.address, pass, notes: notes.trim(), signature,
    });
    await refresh();
  });

  const expire = (job: DigitalJob) => act(job, "expire", [BigInt(job.onchainId)]);
  /** Rules version 2: call a draft off, or agree to cancel a funded job. */
  const cancel = (job: DigitalJob) => act(job, "cancel", [BigInt(job.onchainId)]);
  /** Withdraws from every deployment that owes this account something. */
  const withdraw = () => run(async (account) => {
    const owed = claimableBy.length ? claimableBy : [{ at: digitalWorkAddress()!, amount: claimable }];
    for (const { at } of owed) {
      const transaction = await sendDigitalAction({ account, functionName: "withdraw", args: [], report: setProgress, at });
      if (transaction.status !== "confirmed") throw new Error(transaction.error ?? "Withdrawal did not confirm.");
    }
    await wallet.refresh();
    await refresh();
  });

  const loadDetail = useCallback(async (job: DigitalJob) => {
    const proofs = await proveParticipation();
    const query = `onchainId=${encodeURIComponent(job.onchainId)}&contract=${job.contract}&proofs=${encodeURIComponent(JSON.stringify(proofs))}`;
    const [submissionsResponse, runsResponse, votesResponse] = await Promise.all([
      fetch(`/api/digital-work/submissions?${query}`),
      fetch(`/api/digital-work/verify?${query}`),
      fetch(`/api/digital-work/manual-votes?${query}`),
    ]);
    if (!submissionsResponse.ok || !runsResponse.ok || !votesResponse.ok)
      throw new Error("Could not load verification history.");
    const submissions = await submissionsResponse.json() as { submissions: DigitalSubmission[] };
    const runs = await runsResponse.json() as { runs: DigitalRun[] };
    const manualVotes = await votesResponse.json() as { votes: DigitalManualVote[] };
    return { submissions: submissions.submissions, runs: runs.runs, manualVotes: manualVotes.votes };
  }, [proveParticipation]);

  return {
    config, jobs, claimable, loading, busy, error, setError, notice, setNotice, progress,
    refresh, create, accept, fund, submit, verify, vote, expire, cancel, withdraw, loadDetail,
    token,
  };
}
