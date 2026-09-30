"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ShieldCheck, Wallet } from "lucide-react";
import { useWallet } from "../wallet-context";
import { useLiveAgreements } from "../use-live-agreements";
import { useDigitalWork } from "../use-digital-work";
import { formatAmount, token } from "@/lib/chain";
import { digitalWorkAbi, digitalWorkAddress, DigitalWorkStatus, readDigitalClaimable } from "@/lib/digital-work-chain";
import { publicClient } from "@/lib/ausd";
import type { JobKind } from "@/lib/next-actions";
import { SignInCard } from "./home";

/**
 * What this person has earned across both escrows, read from the contracts.
 *
 * In normal use a passkey is one person with one account. The three-role
 * walkthrough derives an account per role, so there every one of them is
 * counted. Earlier this page read the worker and verifier addresses even in
 * normal mode, where neither is the account people actually use, so real
 * earnings showed as zero.
 *
 * The two contracts hold earnings differently. The milestone escrow keeps a
 * balance per job, withdrawn from inside that job. The proof-checked escrow
 * pools everything one address is owed (pay, reviewer fees and refunds) into
 * one balance, withdrawn in a single step.
 */

type Row = { key: string; kind: JobKind; id: string; title: string; role: string; amount: bigint };

export function LiveEarnings({ onOpen }: { onOpen: (id: string, kind: JobKind) => void }) {
  const w = useWallet();
  if (!w.wallet) return <SignInCard />;
  return <Earnings onOpen={onOpen} />;
}

function Earnings({ onOpen }: { onOpen: (id: string, kind: JobKind) => void }) {
  const w = useWallet();
  const live = useLiveAgreements();
  const digital = useDigitalWork();
  const wallet = w.wallet!;
  const mine = useMemo(
    () => (w.demoRoles ? [wallet.addresses.payer, wallet.addresses.worker, wallet.addresses.verifier] : [wallet.addresses.payer])
      .map((a) => a.toLowerCase()),
    [w.demoRoles, wallet],
  );
  const isMine = (address: string) => mine.includes(address.toLowerCase());

  // Pooled proof-checked balances, one per controlled address.
  const [pooled, setPooled] = useState<{ address: `0x${string}`; amount: bigint }[]>([]);
  // Which reviewer fees this person actually earned, keyed by job id.
  const [feesEarned, setFeesEarned] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!digitalWorkAddress()) return;
    let cancelled = false;
    const addresses = mine as `0x${string}`[];
    void Promise.all(addresses.map(async (address) => ({ address, amount: await readDigitalClaimable(address).catch(() => 0n) })))
      .then((list) => { if (!cancelled) setPooled(list); });
    const reviewing = digital.jobs.flatMap((job) => job.verifiers.filter((v) => mine.includes(v.toLowerCase())).map((v) => ({ job, v })));
    void Promise.all(reviewing.map(async ({ job, v }) => {
      const earned = await publicClient().readContract({
        address: digitalWorkAddress()!,
        abi: digitalWorkAbi,
        functionName: "feeEarned",
        args: [BigInt(job.onchainId), v],
      }).catch(() => false) as boolean;
      return [job.id, earned] as const;
    })).then((entries) => { if (!cancelled) setFeesEarned(Object.fromEntries(entries.filter(([, e]) => e))); });
    return () => { cancelled = true; };
  }, [digital.jobs, digital.claimable, mine]);

  // Milestone balances waiting inside each job.
  const milestoneOwed: Row[] = [];
  const earned: Row[] = [];
  let milestoneWithdrawn = 0n;
  for (const a of live.agreements) {
    if (isMine(a.worker)) {
      if (a.chain.workerEarned > a.chain.workerWithdrawn)
        milestoneOwed.push({ key: `m-w-${a.id}`, kind: "milestone", id: a.id, title: a.title, role: "As worker", amount: a.chain.workerEarned - a.chain.workerWithdrawn });
      if (a.chain.workerEarned > 0n) earned.push({ key: `e-m-w-${a.id}`, kind: "milestone", id: a.id, title: a.title, role: "Worker", amount: a.chain.workerEarned });
      milestoneWithdrawn += a.chain.workerWithdrawn;
    }
    if (isMine(a.verifier)) {
      if (a.chain.verifierEarned > a.chain.verifierWithdrawn)
        milestoneOwed.push({ key: `m-v-${a.id}`, kind: "milestone", id: a.id, title: a.title, role: "As reviewer", amount: a.chain.verifierEarned - a.chain.verifierWithdrawn });
      if (a.chain.verifierEarned > 0n) earned.push({ key: `e-m-v-${a.id}`, kind: "milestone", id: a.id, title: a.title, role: "Reviewer fees", amount: a.chain.verifierEarned });
      milestoneWithdrawn += a.chain.verifierWithdrawn;
    }
  }
  for (const job of digital.jobs) {
    if (isMine(job.worker) && job.chain.status === DigitalWorkStatus.paid)
      earned.push({ key: `e-p-w-${job.id}`, kind: "proof", id: job.id, title: job.title, role: "Worker", amount: job.chain.reward });
    if (feesEarned[job.id])
      earned.push({ key: `e-p-v-${job.id}`, kind: "proof", id: job.id, title: job.title, role: "Reviewer fee", amount: job.chain.feePool / 3n });
  }

  const pooledTotal = pooled.reduce((sum, p) => sum + p.amount, 0n);
  const ready = pooledTotal + milestoneOwed.reduce((sum, r) => sum + r.amount, 0n);
  const asWorker = earned.filter((r) => r.role === "Worker").reduce((sum, r) => sum + r.amount, 0n);
  const asReviewer = earned.filter((r) => r.role !== "Worker").reduce((sum, r) => sum + r.amount, 0n);
  const loading = live.loading || digital.loading;
  const current = w.address?.toLowerCase();
  const roleOfAddress = (address: string) =>
    (Object.entries(wallet.addresses).find(([, a]) => a.toLowerCase() === address)?.[0] ?? "payer");

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORK, REWARDED</p>
          <h1>Earnings & withdrawals</h1>
          <p className="muted">
            What you have earned across both kinds of job, read from the escrow
            contracts. Approved work cannot be taken back, however long it waits here.
          </p>
        </div>
      </div>

      <div className="metrics">
        <section className="metric featured">
          <span>Ready to withdraw</span>
          <strong>{formatAmount(ready)}</strong>
          <small>{token.symbol} across both escrows</small>
        </section>
        <section className="metric">
          <span>Earned as worker</span>
          <strong>{formatAmount(asWorker)}</strong>
          <small>{token.symbol} for approved work, all time</small>
        </section>
        <section className="metric">
          <span>Earned as reviewer</span>
          <strong>{formatAmount(asReviewer)}</strong>
          <small>{token.symbol} in fees for decisions you made</small>
        </section>
      </div>

      {(live.error || digital.error) && (
        <div role="alert" className="error-banner">
          {live.error || digital.error}
          <button className="text-button" onClick={() => { live.setError(""); digital.setError(""); void live.refresh(); void digital.refresh(); }}>Retry</button>
        </div>
      )}

      <h2 className="section-heading">Waiting for you</h2>
      {loading && !milestoneOwed.length && !pooledTotal ? <p className="muted">Reading the network…</p> : null}

      {pooled.filter((p) => p.amount > 0n).map((p) => {
        const canWithdraw = p.address === current;
        return (
          <div className="earning-row" key={p.address}>
            <div>
              <h3>Proof-checked balance{w.demoRoles ? ` · ${roleOfAddress(p.address)} account` : ""}</h3>
              <p className="muted">
                {formatAmount(p.amount)} {token.symbol}. Pay, reviewer fees and any refunds from
                proof-checked jobs collect here and come out in one withdrawal.
              </p>
            </div>
            {canWithdraw ? (
              <button className="primary" disabled={digital.busy} onClick={() => void digital.withdraw()}>
                {digital.busy ? "Withdrawing…" : "Withdraw"}
              </button>
            ) : (
              <span className="muted">Switch to the {roleOfAddress(p.address)} view to withdraw</span>
            )}
          </div>
        );
      })}

      {milestoneOwed.map((r) => (
        <div className="earning-row" key={r.key}>
          <div>
            <h3>{r.title}</h3>
            <p className="muted">Milestone job · {r.role} · {formatAmount(r.amount)} {token.symbol} waiting</p>
          </div>
          <button className="secondary" onClick={() => onOpen(r.id, r.kind)}>
            Withdraw in job <ArrowUpRight size={16} aria-hidden />
          </button>
        </div>
      ))}

      {!loading && ready === 0n && (
        <div className="empty-state">
          <Wallet />
          <h2>Nothing waiting right now.</h2>
          <p>When a job you worked on or reviewed is approved, your pay appears here to withdraw.</p>
        </div>
      )}

      {earned.length > 0 && (
        <>
          <h2 className="section-heading">Earned so far</h2>
          <div className="notice">
            <ShieldCheck size={18} />
            <p>
              Milestone jobs: {formatAmount(milestoneWithdrawn)} {token.symbol} already withdrawn.
              Proof-checked withdrawals are pooled, so they show in Activity rather than per job.
            </p>
          </div>
          {earned.map((r) => (
            <div className="earning-row" key={r.key}>
              <div>
                <h3>{r.title}</h3>
                <p className="muted">{r.kind === "proof" ? "Proof-checked" : "Milestone"} · {r.role}</p>
              </div>
              <button className="text-button" onClick={() => onOpen(r.id, r.kind)}>
                {formatAmount(r.amount)} {token.symbol} <ArrowUpRight size={14} aria-hidden />
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );
}
