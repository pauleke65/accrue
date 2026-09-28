"use client";

import { useState } from "react";
import { ArrowUpRight, Bot, CheckCircle2, Clock3, Plus, ShieldCheck } from "lucide-react";
import { formatAmount, shortAddress, token } from "@/lib/chain";
import { DigitalWorkStatus } from "@/lib/digital-work-chain";
import { digitalJobId } from "@/lib/digital-work-id";
import { useDigitalWork, type DigitalJob } from "../use-digital-work";
import { useWallet } from "../wallet-context";
import { DigitalWorkBuilder } from "./digital-work-builder";
import { DigitalWorkDetail } from "./digital-work-detail";

function statusLabel(job: DigitalJob): string {
  switch (job.chain.status) {
    case DigitalWorkStatus.draft: return job.chain.workerAccepted ? "Ready to fund" : "Waiting for worker";
    case DigitalWorkStatus.funded: return "Funded";
    case DigitalWorkStatus.submitted: return "In verification";
    case DigitalWorkStatus.needsChanges: return "Changes requested";
    case DigitalWorkStatus.paid: return "Verified & paid";
    case DigitalWorkStatus.refunded: return "Refunded";
    default: return "Unknown";
  }
}

export function DigitalWork() {
  const wallet = useWallet();
  const digital = useDigitalWork();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = digital.jobs.find((job) => job.id === selectedId) ?? null;
  const funded = digital.jobs.filter((job) => job.chain.status === DigitalWorkStatus.funded ||
    job.chain.status === DigitalWorkStatus.submitted || job.chain.status === DigitalWorkStatus.needsChanges).length;
  const verified = digital.jobs.filter((job) => job.chain.status === DigitalWorkStatus.paid).length;

  if (!wallet.wallet) return (
    <div className="empty-state">
      <Bot size={34} />
      <h2>Sign in to pay for verified work.</h2>
      <p>Fund an API task, inspect its tests and Jev evaluation, then settle through an independent verifier quorum.</p>
      <a className="secondary" href="/demo.html">Explore the live testnet demo <ArrowUpRight size={15} /></a>
    </div>
  );

  if (creating) return (
    <DigitalWorkBuilder
      config={digital.config}
      busy={digital.busy}
      error={digital.error}
      onBack={() => setCreating(false)}
      onCreate={async (draft) => {
        const id = await digital.create(draft);
        if (id) {
          setCreating(false);
          setSelectedId(digitalJobId(id));
        }
      }}
    />
  );

  if (selected) return (
    <DigitalWorkDetail job={selected} digital={digital} onBack={() => setSelectedId(null)} />
  );

  return (
    <>
      <div className="page-heading dw-heading">
        <div>
          <p className="eyebrow">DIGITAL WORK / MONAD TESTNET</p>
          <h1>Pay for the outcome<span className="heading-dot">.</span></h1>
          <p className="muted">AUSD is reserved for a specific API result. The worker pins the artifact; locked checks and independent verifiers decide what happens next.</p>
        </div>
        <button className="primary" disabled={!digital.config?.contractAddress || !digital.config?.jevAddress} onClick={() => setCreating(true)}>
          <Plus size={16} /> New digital job
        </button>
      </div>

      {digital.error && <div role="alert" className="error-banner">{digital.error}<button className="text-button" onClick={() => digital.setError("")}>Dismiss</button></div>}
      {!digital.config?.contractAddress && <div className="notice"><ShieldCheck size={18} /><p>The digital-work contract has not been configured on this deployment. The existing milestone escrow remains available under Agreements.</p></div>}
      {digital.config?.contractAddress && !digital.config.modelReady && <div className="notice"><Bot size={18} /><p>Jev is not connected here yet. Add a free BeatAPI key or Cloudflare AI access to enable the agent vote.</p></div>}

      <div className="dw-intro-grid">
        <div className="dw-intro-card"><span>01 / DEFINE</span><strong>Lock the policy</strong><p>Reward, API behavior, deadline, and 2-of-3 verifier set are fixed before funding.</p></div>
        <div className="dw-intro-card"><span>02 / VERIFY</span><strong>Run evidence</strong><p>Public commit and deployed endpoint checks feed a Cloudflare Worker using Jev.</p></div>
        <div className="dw-intro-card"><span>03 / SETTLE</span><strong>Pay on proof</strong><p>Two distinct verifier votes release the worker reward. Missed review returns reserved funds.</p></div>
      </div>

      <div className="metrics">
        <section className="metric featured"><span>Active digital jobs</span><strong>{funded.toString().padStart(2, "0")}</strong><small>Funded and in progress</small></section>
        <section className="metric"><span>Verified outcomes</span><strong>{verified.toString().padStart(2, "0")}</strong><small>2-of-3 approval reached</small></section>
        <section className="metric"><span>Available to withdraw</span><strong>{formatAmount(digital.claimable)}</strong><small>{token.symbol} earned across your jobs</small></section>
      </div>

      <div className="dw-list-heading"><div><p className="eyebrow">YOUR WORK</p><h2>Digital agreements</h2></div><span>{digital.jobs.length} jobs</span></div>
      {digital.loading ? <p className="muted">Reading jobs from Monad…</p> : digital.jobs.length === 0 ? (
        <div className="empty-state"><Bot size={34} /><h2>No digital jobs yet.</h2><p>Create an API task or wait to be named as its worker or verifier.</p></div>
      ) : (
        <div className="dw-job-grid">
          {digital.jobs.map((job) => (
            <button key={job.id} className="dw-job-card" onClick={() => setSelectedId(job.id)}>
              <div className="dw-job-top"><span className="badge">{statusLabel(job)}</span><ArrowUpRight size={17} /></div>
              <h3>{job.title}</h3>
              <p>{job.policy.brief}</p>
              <div className="dw-job-meta"><span><Clock3 size={14} /> {new Date(Number(job.chain.deliveryDeadline) * 1000).toLocaleDateString()}</span><span><CheckCircle2 size={14} /> {job.chain.passVotes}/2 approvals</span></div>
              <div className="dw-job-foot"><span>Worker {shortAddress(job.worker)}</span><strong>{formatAmount(job.chain.reward)} {token.symbol}</strong></div>
            </button>
          ))}
        </div>
      )}
      {digital.claimable > 0n && <div className="action-banner"><div><h3>{formatAmount(digital.claimable)} {token.symbol} is ready.</h3><p>Your verified work or verifier fee can be withdrawn now.</p></div><button className="primary" disabled={digital.busy} onClick={() => void digital.withdraw()}>Withdraw</button></div>}
    </>
  );
}
