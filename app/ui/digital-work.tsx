"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, Plus, ScanSearch, ShieldCheck } from "lucide-react";
import { formatAmount, shortAddress, token } from "@/lib/chain";
import { DigitalWorkStatus } from "@/lib/digital-work-chain";
import { digitalJobId } from "@/lib/digital-work-id";
import { useDigitalWork, type DigitalDraft, type DigitalJob } from "../use-digital-work";
import { useOffers } from "../use-offers";
import { useWallet } from "../wallet-context";
import { DigitalWorkBuilder } from "./digital-work-builder";
import { DigitalWorkDetail } from "./digital-work-detail";
import { SignInCard } from "./home";

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

export function DigitalWork({ initialCreating = false, initialSelectedId = null, offer = null }: {
  /** Set when Home sends someone straight to the builder or to one job. */
  initialCreating?: boolean;
  initialSelectedId?: string | null;
  /** A taken hiring link to turn into a real job. */
  offer?: { token: string; draft: DigitalDraft; takenBy: string } | null;
} = {}) {
  const wallet = useWallet();
  const digital = useDigitalWork();
  const offers = useOffers();
  const [creating, setCreating] = useState(initialCreating);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const selected = digital.jobs.find((job) => job.id === selectedId) ?? null;
  const funded = digital.jobs.filter((job) => job.chain.status === DigitalWorkStatus.funded ||
    job.chain.status === DigitalWorkStatus.submitted || job.chain.status === DigitalWorkStatus.needsChanges).length;
  const verified = digital.jobs.filter((job) => job.chain.status === DigitalWorkStatus.paid).length;

  if (!wallet.wallet) return <SignInCard />;

  if (creating) return (
    <DigitalWorkBuilder
      config={digital.config}
      busy={digital.busy}
      error={digital.error}
      initialDraft={offer?.draft}
      takenBy={offer?.takenBy ?? null}
      onBack={() => setCreating(false)}
      onHiringLink={(title, draft) => offers.create("proof", title, draft as unknown as Record<string, unknown>)}
      onCreate={async (draft) => {
        const id = await digital.create(draft);
        if (id) {
          // The offer has done its job; stop showing it as waiting on the client.
          if (offer) await offers.update(offer.token, "created", digitalJobId(id)).catch(() => undefined);
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
      <div className="jobs-heading">
        <div>
          <h2>Proof-checked jobs</h2>
          <p className="muted">One deliverable, checked by Proof Engine and two reviewers. Two of three pass votes release payment.</p>
        </div>
        <button className="primary" disabled={!digital.config?.contractAddress || !digital.config?.jevAddress} onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> New proof-checked job</button>
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
        <div className="empty-state"><ScanSearch size={34} /><h2>No proof-checked jobs yet.</h2><p>Create one for a deliverable with a testable outcome, or ask the client to name your @name as worker or reviewer.</p><button className="primary" disabled={!digital.config?.contractAddress || !digital.config?.jevAddress} onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> New proof-checked job</button></div>
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
