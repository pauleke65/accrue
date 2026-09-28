"use client";

import { ArrowUpRight, Check, ScanSearch, X } from "lucide-react";
import { explorer } from "@/lib/chain";
import type { DigitalRun } from "../use-digital-work";

export function ProofEngineReport({ run, provider }: { run: DigitalRun; provider: string }) {
  if (!run.report) return null;

  const { checks, jev } = run.report;
  const reviewNeeded = jev.recommendation === "manual_review";
  const decision = reviewNeeded ? "Human review needed" : jev.recommendation === "pass" ? "Automated pass" : "Changes recommended";
  const requirements = Math.round(jev.requirementsProbability * 100);
  const review = Math.round(jev.reviewProbability * 100);

  return (
    <section className="dw-proof-report" aria-label="Proof Engine verification report">
      <div className="dw-proof-head">
        <div className="dw-proof-mark"><ScanSearch size={24} strokeWidth={1.8} /></div>
        <div><span className="dw-proof-kicker">ACCRUE / PROOF ENGINE</span><h3>Evidence review</h3></div>
        <span className={`dw-proof-decision ${reviewNeeded ? "needs-review" : jev.recommendation === "pass" ? "passed" : "failed"}`}>{decision}</span>
      </div>

      <div className="dw-proof-checks">
        <div><span className={checks.commitFound ? "" : "failed"}>{checks.commitFound ? <Check size={17} /> : <X size={17} />}</span><strong>Public commit</strong><small>{checks.commitFound ? "Found" : "Not found"}</small></div>
        <div><span className={checks.statusMatches ? "" : "failed"}>{checks.statusMatches ? <Check size={17} /> : <X size={17} />}</span><strong>HTTP response</strong><small>{checks.statusMatches ? "Matched" : "Mismatch"}</small></div>
        <div><span className={checks.bodyMatches ? "" : "failed"}>{checks.bodyMatches ? <Check size={17} /> : <X size={17} />}</span><strong>JSON result</strong><small>{checks.bodyMatches ? "Matched" : "Mismatch"}</small></div>
      </div>

      <div className="dw-proof-signals">
        <div className="dw-proof-signal"><div><span>Requirements confidence</span><strong>{requirements}%</strong></div><div className="dw-proof-bar"><span style={{ width: `${requirements}%` }} /></div></div>
        <div className="dw-proof-signal"><div><span>Human review need</span><strong>{review}%</strong></div><div className="dw-proof-bar review"><span style={{ width: `${review}%` }} /></div><small>Agreement limit: 10%</small></div>
      </div>

      <div className={`dw-proof-conclusion ${reviewNeeded ? "needs-review" : jev.recommendation === "pass" ? "passed" : "failed"}`}>
        <strong>{reviewNeeded ? "The engine abstained." : jev.recommendation === "pass" ? "The automated reviewer voted pass." : "The automated reviewer voted fail."}</strong>
        <p>{reviewNeeded ? `Human review need is ${review}%, above the agreement’s 10% limit. Two named reviewers can decide the result.` : "The result follows the threshold locked into this agreement before funding."}</p>
      </div>
      {checks.error && <p className="dw-proof-error">Check error: {checks.error}</p>}
      <details className="dw-proof-technical"><summary>Technical record</summary><p>Model: {jev.model} · Provider: {provider}</p>{run.reportHash && <p>Report hash: {run.reportHash}</p>}{run.voteTx && <a href={explorer.tx(run.voteTx)} target="_blank" rel="noreferrer noopener">View automated vote on Monad <ArrowUpRight size={13} /></a>}</details>
    </section>
  );
}
