"use client";
import { ArrowUpRight, ShieldCheck, Wallet } from "lucide-react";
import { useWallet } from "../wallet-context";
import { useLiveAgreements, type LiveAgreement } from "../use-live-agreements";
import { formatAmount, token } from "@/lib/chain";

/**
 * What a worker or verifier has actually earned, read from the escrow.
 *
 * One passkey derives a separate address for each role, so "what have I
 * earned" has two honest answers at once — one as the worker, one as the
 * verifier — regardless of which role view happens to be selected. Both are
 * shown together rather than making someone switch roles just to check.
 */

function forRole(
  agreements: LiveAgreement[],
  address: `0x${string}` | undefined,
  role: "worker" | "verifier",
) {
  if (!address) return { available: 0n, withdrawn: 0n };
  const lower = address.toLowerCase();
  let available = 0n;
  let withdrawn = 0n;
  for (const a of agreements) {
    if (a[role].toLowerCase() !== lower) continue;
    const earned =
      role === "worker" ? a.chain.workerEarned : a.chain.verifierEarned;
    const paid =
      role === "worker" ? a.chain.workerWithdrawn : a.chain.verifierWithdrawn;
    available += earned - paid;
    withdrawn += paid;
  }
  return { available, withdrawn };
}

export function LiveEarnings({ onOpen }: { onOpen: (id: string) => void }) {
  const w = useWallet();
  const live = useLiveAgreements();

  if (!w.wallet)
    return (
      <div className="empty-state">
        <Wallet />
        <h2>Sign in to see what you have earned.</h2>
        <p>
          Earnings are read from the escrow contract, not stored by the app.
        </p>
      </div>
    );

  const worker = forRole(live.agreements, w.wallet.addresses.worker, "worker");
  const verifier = forRole(
    live.agreements,
    w.wallet.addresses.verifier,
    "verifier",
  );

  const owing = live.agreements.filter((a) => {
    const asWorker =
      a.worker.toLowerCase() === w.wallet!.addresses.worker.toLowerCase() &&
      a.chain.workerEarned > a.chain.workerWithdrawn;
    const asVerifier =
      a.verifier.toLowerCase() === w.wallet!.addresses.verifier.toLowerCase() &&
      a.chain.verifierEarned > a.chain.verifierWithdrawn;
    return asWorker || asVerifier;
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORK, REWARDED</p>
          <h1>Earnings & withdrawals</h1>
          <p className="muted">
            Earned is not the same as withdrawn. Every figure here is read from
            the escrow contract, for both of your roles at once.
          </p>
        </div>
      </div>

      <div className="metrics">
        <section className="metric featured">
          <span>Worker · available to withdraw</span>
          <strong>{formatAmount(worker.available)}</strong>
          <small>
            Withdrawn {formatAmount(worker.withdrawn)} {token.symbol}
          </small>
        </section>
        <section className="metric">
          <span>Verifier · available to withdraw</span>
          <strong>{formatAmount(verifier.available)}</strong>
          <small>
            Withdrawn {formatAmount(verifier.withdrawn)} {token.symbol}
          </small>
        </section>
      </div>

      <div className="notice">
        <ShieldCheck />
        <p>
          Open a job to withdraw that role&apos;s available balance. Approved
          work cannot be reclaimed by the payer, however long it sits here.
        </p>
      </div>

      {live.loading && <p className="muted">Reading the network…</p>}

      {!live.loading && owing.length
        ? owing.map((a) => {
            const isWorker =
              a.worker.toLowerCase() ===
              w.wallet!.addresses.worker.toLowerCase();
            const mine = isWorker
              ? a.chain.workerEarned - a.chain.workerWithdrawn
              : a.chain.verifierEarned - a.chain.verifierWithdrawn;
            return (
              <div className="earning-row" key={a.id}>
                <div>
                  <h3>{a.title}</h3>
                  <p className="muted">
                    {isWorker ? "As worker" : "As verifier"} ·{" "}
                    {formatAmount(mine)} {token.symbol} waiting
                  </p>
                </div>
                <button className="secondary" onClick={() => onOpen(a.id)}>
                  Open job
                  <ArrowUpRight size={16} />
                </button>
              </div>
            );
          })
        : !live.loading && (
            <div className="empty-state">
              <Wallet />
              <h2>Your earned allocations will appear here.</h2>
              <p>Nothing is waiting for either of your roles right now.</p>
            </div>
          )}
    </>
  );
}
