"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Plus, ScanSearch, ShieldCheck } from "lucide-react";
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
    <div className="dw-signin-hero">
      <div className="dw-signin-copy">
        <span className="dw-product-name"><ScanSearch size={18} /> ACCRUE PROOF ENGINE</span>
        <h1>Work pays when <em>proof holds.</em></h1>
        <p>Fund an API outcome. Automated checks and independent reviewers inspect the evidence before Accrue releases payment.</p>
        <a className="primary" href="/proof-engine-walkthrough.mp4">Watch the real walkthrough <ArrowUpRight size={15} /></a>
        <small>Sign in with a passkey to create or review an agreement.</small>
      </div>
      <a className="dw-signin-proof" href="/demo.html" aria-label="Explore the proof trail for paid testnet job 6">
        <div className="dw-signin-proof-top"><span>LIVE PROOF / JOB #6</span><span>MONAD TESTNET</span></div>
        <div className="dw-signin-proof-amount"><strong>5.00</strong><span>AUSD<br />PAID TO WORKER</span></div>
        <div className="dw-signin-proof-checks"><span><CheckCircle2 size={16} /> Commit found</span><span><CheckCircle2 size={16} /> API responded</span><span><CheckCircle2 size={16} /> JSON matched</span></div>
        <div className="dw-signin-proof-note"><span>94% requirements confidence</span><span>15% human review need</span><strong>Proof Engine abstained. Two reviewers passed.</strong></div>
        <div className="dw-signin-proof-link">Follow the proof trail <ArrowUpRight size={17} /></div>
      </a>
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
      <div className="dw-protocol-hero">
        <div className="dw-protocol-copy">
          <span className="dw-product-name"><ScanSearch size={17} /> ACCRUE PROOF ENGINE <i /> LIVE ON MONAD TESTNET</span>
          <h1>Work pays when <em>proof holds.</em></h1>
          <p>Set the outcome. Lock the reward. Proof Engine checks the evidence, and independent reviewers decide what is uncertain.</p>
          <div className="dw-hero-actions"><button className="primary" disabled={!digital.config?.contractAddress || !digital.config?.jevAddress} onClick={() => setCreating(true)}><Plus size={17} /> Create an agreement</button><a href="#digital-agreements">View your work <ArrowRight size={16} /></a></div>
          <div className="dw-hero-facts"><span><ShieldCheck size={15} /> Terms locked before funding</span><span><CheckCircle2 size={15} /> 2 of 3 votes to settle</span></div>
        </div>
        <div className="dw-engine-visual" aria-label="Proof Engine verification path">
          <div className="dw-engine-visual-top"><span>PROOF ENGINE / LIVE REVIEW</span><span className="dw-live-dot">SYSTEM READY</span></div>
          <div className="dw-engine-visual-main"><ScanSearch size={38} strokeWidth={1.3} /><strong>Proof, then payment.</strong><p>One continuous record from the agreed test to the final on-chain vote.</p></div>
          <div className="dw-engine-visual-steps"><span>LOCK <b>01</b></span><i /><span>CHECK <b>02</b></span><i /><span>DECIDE <b>03</b></span><i /><span>PAY <b>04</b></span></div>
          <div className="dw-engine-visual-foot">AI checks quickly. Human reviewers resolve uncertainty. The contract settles the outcome.</div>
        </div>
      </div>

      {digital.error && <div role="alert" className="error-banner">{digital.error}<button className="text-button" onClick={() => digital.setError("")}>Dismiss</button></div>}
      {!digital.config?.contractAddress && <div className="notice"><ShieldCheck size={18} /><p>The digital-work contract has not been configured on this deployment. The existing milestone escrow remains available under Agreements.</p></div>}
      {digital.config?.contractAddress && !digital.config.modelReady && <div className="notice"><ScanSearch size={18} /><p>Proof Engine is not connected on this deployment. Configure its AI provider to enable automated review.</p></div>}

      <div className="metrics dw-metrics">
        <section className="metric featured"><span>Active digital jobs</span><strong>{funded.toString().padStart(2, "0")}</strong><small>Funded and in progress</small></section>
        <section className="metric"><span>Verified outcomes</span><strong>{verified.toString().padStart(2, "0")}</strong><small>2-of-3 approval reached</small></section>
        <section className="metric"><span>Available to withdraw</span><strong>{formatAmount(digital.claimable)}</strong><small>{token.symbol} earned across your jobs</small></section>
      </div>

      <div id="digital-agreements" className="dw-list-heading"><div><h2>Your agreements</h2><p>From locked outcome to verified payout.</p></div><span>{digital.jobs.length} jobs</span></div>
      {digital.loading ? <p className="muted">Reading jobs from Monad…</p> : digital.jobs.length === 0 ? (
        <div className="empty-state"><ScanSearch size={34} /><h2>No agreements yet.</h2><p>Create an API task or wait to be invited as its worker or reviewer.</p></div>
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
