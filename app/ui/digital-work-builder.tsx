"use client";

import { useState } from "react";
import { ArrowLeft, Bot, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { shortAddress, token } from "@/lib/chain";
import type { DigitalConfig, DigitalDraft } from "../use-digital-work";

const startingDraft: DigitalDraft = {
  policy: {
    title: "Build a REST API endpoint",
    brief: "Build and deploy a public API endpoint that returns the agreed JSON response.",
    endpointPath: "/api/health",
    expectedStatus: 200,
    expectedJsonKey: "ok",
    expectedJsonValue: "true",
    passThreshold: 0.9,
    failThreshold: 0.1,
  },
  worker: "",
  reviewerB: "",
  reviewerC: "",
  reward: "100.00",
  verifierFees: "3.00",
  deliveryHours: 48,
  reviewHours: 24,
};

export function DigitalWorkBuilder({
  config, busy, error, onBack, onCreate,
}: {
  config: DigitalConfig | null;
  busy: boolean;
  error: string;
  onBack: () => void;
  onCreate: (draft: DigitalDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState(startingDraft);
  const set = (patch: Partial<DigitalDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const setPolicy = (patch: Partial<DigitalDraft["policy"]>) => setDraft((current) => ({
    ...current, policy: { ...current.policy, ...patch },
  }));

  return (
    <>
      <button className="text-button back" onClick={onBack}><ArrowLeft size={15} /> Digital work</button>
      <div className="page-heading">
        <div><p className="eyebrow">NEW AGREEMENT / SOFTWARE API</p><h1>Define the result.</h1><p className="muted">The policy and three verifier addresses are hashed into a single-deliverable contract. Everyone sees the same test before funds move.</p></div>
      </div>
      {error && <div role="alert" className="error-banner">{error}</div>}
      <form className="dw-builder" onSubmit={(event) => { event.preventDefault(); void onCreate(draft); }}>
        <section className="panel dw-form-section">
          <div className="dw-section-head"><span>01</span><div><h2>The work</h2><p>One public API endpoint and one pinned commit.</p></div></div>
          <div className="form-stack">
            <label>Job title<Input value={draft.policy.title} maxLength={120} onChange={(event) => setPolicy({ title: event.target.value })} required /></label>
            <label>Brief and acceptance criteria<Textarea value={draft.policy.brief} maxLength={2000} onChange={(event) => setPolicy({ brief: event.target.value })} required /></label>
            <div className="form-grid">
              <label>Endpoint path<Input value={draft.policy.endpointPath} onChange={(event) => setPolicy({ endpointPath: event.target.value })} placeholder="/api/health" required /></label>
              <label>Expected HTTP status<Input type="number" min={200} max={299} value={draft.policy.expectedStatus} onChange={(event) => setPolicy({ expectedStatus: Number(event.target.value) })} required /></label>
            </div>
            <div className="form-grid">
              <label>JSON field<Input value={draft.policy.expectedJsonKey} onChange={(event) => setPolicy({ expectedJsonKey: event.target.value })} placeholder="ok" required /></label>
              <label>Expected value<Input value={draft.policy.expectedJsonValue} onChange={(event) => setPolicy({ expectedJsonValue: event.target.value })} placeholder="true" required /></label>
            </div>
          </div>
        </section>

        <section className="panel dw-form-section">
          <div className="dw-section-head"><span>02</span><div><h2>People and AI</h2><p>Jev is one vote. Two other independently controlled reviewers complete the set.</p></div></div>
          <div className="form-stack">
            <label>Worker @tag or wallet address<Input value={draft.worker} onChange={(event) => set({ worker: event.target.value })} placeholder="@worker" required /></label>
            <div className="dw-jev-identity"><Bot size={20} /><div><strong>Jev · {config?.provider ?? "AI"}</strong><span>{config?.jevAddress ? `Verifier ${shortAddress(config.jevAddress)}` : "Verifier wallet not configured"} · {config?.modelReady ? "model configured" : "model not configured"}</span></div></div>
            <div className="form-grid">
              <label>Reviewer two<Input value={draft.reviewerB} onChange={(event) => set({ reviewerB: event.target.value })} placeholder="@reviewer or 0x…" required /></label>
              <label>Reviewer three<Input value={draft.reviewerC} onChange={(event) => set({ reviewerC: event.target.value })} placeholder="@reviewer or 0x…" required /></label>
            </div>
            <p className="fine-print">Each reviewer must control a different address. The contract rejects duplicates and prevents the payer or worker from voting.</p>
          </div>
        </section>

        <section className="panel dw-form-section">
          <div className="dw-section-head"><span>03</span><div><h2>Money and time</h2><p>Verifier fees are earned when each verifier submits a first vote, even if they vote fail.</p></div></div>
          <div className="form-stack">
            <div className="form-grid">
              <label>Worker reward ({token.symbol})<Input value={draft.reward} onChange={(event) => set({ reward: event.target.value })} inputMode="decimal" required /></label>
              <label>Total verifier fee pool ({token.symbol})<Input value={draft.verifierFees} onChange={(event) => set({ verifierFees: event.target.value })} inputMode="decimal" required /></label>
            </div>
            <div className="form-grid">
              <label>Hours to deliver<Input type="number" min={1} max={720} value={draft.deliveryHours} onChange={(event) => set({ deliveryHours: Number(event.target.value) })} required /></label>
              <label>Hours to review after delivery<Input type="number" min={1} max={168} value={draft.reviewHours} onChange={(event) => set({ reviewHours: Number(event.target.value) })} required /></label>
            </div>
          </div>
        </section>

        <div className="action-banner"><div><h3>Review the locked policy.</h3><p><ShieldCheck size={15} /> Jev pass threshold 90%. Uncertain results require human review. Funding begins after the worker accepts.</p></div><button className="primary" type="submit" disabled={busy || !config?.contractAddress || !config?.jevAddress}>{busy ? "Creating…" : "Create digital job"}</button></div>
      </form>
    </>
  );
}
