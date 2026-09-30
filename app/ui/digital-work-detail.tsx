"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock3, Copy, Hourglass, ScanSearch, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { explorer, formatAmount, shortAddress, token } from "@/lib/chain";
import { DigitalWorkStatus, readDigitalVote } from "@/lib/digital-work-chain";
import { useWallet } from "../wallet-context";
import type { DigitalJob, DigitalManualVote, DigitalRun, DigitalSubmission, useDigitalWork } from "../use-digital-work";
import { ProofEngineReport } from "./proof-engine-report";
import { deliverableKind, type DigitalManifest } from "@/lib/digital-work-policy";
import { proofActions } from "@/lib/next-actions";

type VoteState = { version: number; pass: boolean; reportHash: `0x${string}` };

function formatDeadline(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleString();
}

export function DigitalWorkDetail({
  job, digital, onBack,
}: {
  job: DigitalJob;
  digital: ReturnType<typeof useDigitalWork>;
  onBack: () => void;
}) {
  const wallet = useWallet();
  const [evidence, setEvidence] = useState({ commitUrl: "", deploymentUrl: "", pageUrl: "", pullRequestUrl: "", notes: "" });
  const [linkCopied, setLinkCopied] = useState(false);
  const kind = deliverableKind(job.policy);
  const policy = job.policy as Record<string, string | number>;
  // Only the fields this job's deliverable type accepts; the server rejects
  // evidence of the wrong kind.
  const manifest: DigitalManifest = kind === "webpage" ? { pageUrl: evidence.pageUrl, notes: evidence.notes }
    : kind === "pull_request" ? { pullRequestUrl: evidence.pullRequestUrl, notes: evidence.notes }
    : { commitUrl: evidence.commitUrl, deploymentUrl: evidence.deploymentUrl, notes: evidence.notes };
  const [voteNotes, setVoteNotes] = useState("");
  const [submissions, setSubmissions] = useState<DigitalSubmission[]>([]);
  const [runs, setRuns] = useState<DigitalRun[]>([]);
  const [manualVotes, setManualVotes] = useState<DigitalManualVote[]>([]);
  const [votes, setVotes] = useState<VoteState[]>([]);
  const [detailError, setDetailError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const loadDetail = digital.loadDetail;
  const isPayer = wallet.address?.toLowerCase() === job.payer.toLowerCase();
  const isWorker = wallet.address?.toLowerCase() === job.worker.toLowerCase();
  const verifierIndex = job.verifiers.findIndex((address) => address.toLowerCase() === wallet.address?.toLowerCase());
  const isVerifier = verifierIndex >= 0;
  const currentRun = runs.find((run) => run.version === job.chain.version);
  const currentSubmission = submissions.find((submission) => submission.version === job.chain.version);
  const currentVote = verifierIndex >= 0 ? votes[verifierIndex] : null;
  const alreadyVoted = currentVote?.version === job.chain.version;
  const reviewExpired = now / 1000 > Number(job.chain.reviewDeadline);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadDetail(job),
      Promise.all(job.verifiers.map((verifier) => readDigitalVote(BigInt(job.onchainId), verifier))),
    ]).then(([detail, chainVotes]) => {
      if (!active) return;
      setSubmissions(detail.submissions);
      setRuns(detail.runs);
      setManualVotes(detail.manualVotes);
      setVotes(chainVotes);
      setDetailError("");
    }).catch((error) => {
      if (active) setDetailError(error instanceof Error ? error.message : "Could not load verification history.");
    });
    return () => { active = false; };
  }, [job, loadDetail]);

  const refreshDetail = async () => {
    const detail = await loadDetail(job);
    setSubmissions(detail.submissions);
    setRuns(detail.runs);
    setManualVotes(detail.manualVotes);
    setVotes(await Promise.all(job.verifiers.map((verifier) => readDigitalVote(BigInt(job.onchainId), verifier))));
  };

  const next = proofActions({
    id: job.id, title: job.title, payer: job.payer, worker: job.worker, verifiers: job.verifiers,
    status: job.chain.status, workerAccepted: job.chain.workerAccepted,
    deliveryDeadline: job.chain.deliveryDeadline, reviewDeadline: job.chain.reviewDeadline,
    votedCurrentVersion: isVerifier ? alreadyVoted : null,
  }, wallet.address, BigInt(Math.floor(now / 1000)))[0];

  const doAction = async (action: () => Promise<unknown>) => {
    await action();
    try { await refreshDetail(); } catch { /* The chain action's result is still shown by the main refresh. */ }
  };

  return (
    <>
      <button className="text-button back" onClick={onBack}><ArrowLeft size={15} aria-hidden /> Jobs</button>
      <div className="page-heading dw-detail-heading">
        <div><p className="eyebrow">AGREEMENT #{job.onchainId} / MONAD TESTNET</p><h1>{job.title}</h1><p className="muted">{job.policy.brief}</p></div>
        <div className="milestone-actions">
          <button className="secondary" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/app?proof=${encodeURIComponent(job.id)}`).then(() => setLinkCopied(true)); }}>
            {linkCopied ? <><Check size={15} aria-hidden /> Copied</> : <><Copy size={15} aria-hidden /> Copy job link</>}
          </button>
          <a className="secondary dw-explorer" href={explorer.address(digital.config?.contractAddress ?? "")} target="_blank" rel="noreferrer noopener">View contract <ArrowUpRight size={15} aria-hidden /></a>
        </div>
      </div>
      {next && (
        <div className={`next-step next-step-${next.owner}`} role="status">
          <span aria-hidden>{next.owner === "you" ? <ArrowRight size={16} /> : <Hourglass size={16} />}</span>
          <div><b>{next.owner === "you" ? `Your move: ${next.action.toLowerCase()}` : next.action}</b><p>{next.detail}</p></div>
        </div>
      )}
      {(digital.error || detailError) && <div role="alert" className="error-banner">{digital.error || detailError}<button className="text-button" onClick={() => { digital.setError(""); setDetailError(""); }}>Dismiss</button></div>}
      {digital.progress.status !== "idle" && digital.busy && <div className="notice"><Clock3 size={16} /><p>Transaction: {digital.progress.status.replaceAll("-", " ")}</p></div>}

      <div className="dw-detail-grid">
        <section className="panel dw-policy-card">
          <div className="dw-section-head"><span>01</span><div><h2>Locked agreement</h2><p>Terms fixed before funding.</p></div></div>
          <div className="dw-key-values">
            <div><span>Worker reward</span><strong>{formatAmount(job.chain.reward)} {token.symbol}</strong></div>
            <div><span>Verifier fees</span><strong>{formatAmount(job.chain.feePool)} {token.symbol}</strong></div>
            <div><span>Deliver by</span><strong>{formatDeadline(job.chain.deliveryDeadline)}</strong></div>
            <div><span>Review closes</span><strong>{formatDeadline(job.chain.reviewDeadline)}</strong></div>
            {kind === "webpage" && <div><span>Live page must contain</span><strong>&ldquo;{policy.requiredText}&rdquo;</strong></div>}
            {kind === "pull_request" && <div><span>Merged into</span><strong>github.com/{policy.repository}</strong></div>}
            {kind === "api" && <>
              <div><span>Endpoint test</span><strong>GET {policy.endpointPath} → {policy.expectedStatus}</strong></div>
              <div><span>Expected JSON</span><strong>{policy.expectedJsonKey}: {policy.expectedJsonValue}</strong></div>
            </>}
          </div>
          <p className="dw-digest">Policy digest · {job.policyHash}</p>
        </section>
        <section className="panel dw-policy-card">
          <div className="dw-section-head"><span>02</span><div><h2>Independent verifiers</h2><p>Any two matching votes decide the result.</p></div></div>
          <div className="dw-verifiers">
            {job.verifiers.map((verifier, index) => {
              const vote = votes[index];
              const voted = vote?.version === job.chain.version && job.chain.version > 0;
              return <div key={verifier} className="dw-verifier"><span className="dw-verifier-icon">{index === 0 ? <ScanSearch size={18} /> : <ShieldCheck size={18} />}</span><div><strong>{index === 0 ? "Proof Engine · automated" : `Reviewer ${index + 1}`}</strong><small>{shortAddress(verifier)}</small></div><span className={`badge ${voted ? (vote.pass ? "dw-pass" : "dw-fail") : ""}`}>{voted ? (vote.pass ? "PASS" : "FAIL") : "Pending"}</span></div>;
            })}
          </div>
          <p className="fine-print">Each verifier earns one third of the fee pool on its first vote, regardless of the verdict. Unused fees return to the payer.</p>
          {manualVotes.filter((vote) => vote.version === job.chain.version).map((vote) => <div className="dw-review-note" key={vote.verifier}><strong>{vote.pass ? "Pass" : "Changes requested"} · {shortAddress(vote.verifier)}</strong><p>{vote.notes}</p><small>Report hash · {vote.reportHash}</small></div>)}
        </section>
      </div>

      {job.chain.status === DigitalWorkStatus.draft && <section className="action-banner"><div><h3>{job.chain.workerAccepted ? "The worker accepted." : "The worker must accept."}</h3><p>The payer funds {formatAmount(job.chain.reward + job.chain.feePool)} {token.symbol} only after the worker accepts the policy hash.</p></div><div className="milestone-actions">{isWorker && !job.chain.workerAccepted && <button className="primary" disabled={digital.busy} onClick={() => void doAction(() => digital.accept(job))}>Accept policy</button>}{isPayer && job.chain.workerAccepted && <button className="primary" disabled={digital.busy} onClick={() => void doAction(() => digital.fund(job))}>Fund job</button>}</div></section>}

      {(job.chain.status === DigitalWorkStatus.funded || job.chain.status === DigitalWorkStatus.needsChanges) && <section className="panel dw-action-card"><div className="dw-section-head"><span>03</span><div><h2>{job.chain.status === DigitalWorkStatus.needsChanges ? "Submit corrected work" : "Submit the work"}</h2><p>{kind === "webpage" ? "Link the live page." : kind === "pull_request" ? "Link the pull request." : "Pin the public commit and deployment."} Its fingerprint goes on chain, so it can&apos;t change during review.</p></div></div>{isWorker ? <div className="form-stack">
        {kind === "webpage" && <label>Link to the live page<Input type="url" value={evidence.pageUrl} onChange={(event) => setEvidence({ ...evidence, pageUrl: event.target.value })} placeholder="https://yoursite.com/pricing" /><small className="field-hint">Must be public HTTPS and contain &ldquo;{policy.requiredText}&rdquo;.</small></label>}
        {kind === "pull_request" && <label>Pull request link<Input type="url" value={evidence.pullRequestUrl} onChange={(event) => setEvidence({ ...evidence, pullRequestUrl: event.target.value })} placeholder={`https://github.com/${policy.repository}/pull/42`} /><small className="field-hint">It counts once a maintainer merges it into {policy.repository}.</small></label>}
        {kind === "api" && <><label>GitHub commit URL<Input type="url" value={evidence.commitUrl} onChange={(event) => setEvidence({ ...evidence, commitUrl: event.target.value })} placeholder="https://github.com/owner/repo/commit/40-character-sha" /></label><label>Deployment URL<Input type="url" value={evidence.deploymentUrl} onChange={(event) => setEvidence({ ...evidence, deploymentUrl: event.target.value })} placeholder="https://example.workers.dev" /></label></>}
        <label>Notes for the reviewers<Textarea value={evidence.notes} onChange={(event) => setEvidence({ ...evidence, notes: event.target.value })} placeholder="What you delivered and how to check it" /></label>
        <button className="primary" disabled={digital.busy} onClick={() => void doAction(() => digital.submit(job, manifest))}>Submit evidence</button>
      </div> : <p className="muted">Waiting for the worker to submit their evidence.</p>}</section>}

      {(job.chain.status === DigitalWorkStatus.submitted || job.chain.status === DigitalWorkStatus.paid) && (
        <section className="panel dw-action-card dw-verification-stage">
          <div className="dw-section-head"><span>04</span><div><h2>{job.chain.status === DigitalWorkStatus.paid ? "Review the proof" : "Verify the evidence"}</h2><p>Proof Engine checks this exact submission. Uncertain results go to the named reviewers.</p></div></div>
          {currentSubmission && <div className="dw-evidence">
            {"commitUrl" in currentSubmission.manifest && <><a href={currentSubmission.manifest.commitUrl} target="_blank" rel="noreferrer noopener">Pinned GitHub commit <ArrowUpRight size={14} aria-hidden /></a><a href={currentSubmission.manifest.deploymentUrl} target="_blank" rel="noreferrer noopener">Deployed endpoint <ArrowUpRight size={14} aria-hidden /></a></>}
            {"pageUrl" in currentSubmission.manifest && <a href={currentSubmission.manifest.pageUrl} target="_blank" rel="noreferrer noopener">Live page <ArrowUpRight size={14} aria-hidden /></a>}
            {"pullRequestUrl" in currentSubmission.manifest && <a href={currentSubmission.manifest.pullRequestUrl} target="_blank" rel="noreferrer noopener">Pull request <ArrowUpRight size={14} aria-hidden /></a>}
            {currentSubmission.manifest.notes && <p>{currentSubmission.manifest.notes}</p>}
            <small>Evidence digest · {currentSubmission.evidenceHash}</small>
          </div>}
          {job.chain.status === DigitalWorkStatus.submitted && <div className="dw-engine-action"><div><span className="dw-engine-action-icon"><ScanSearch size={21} /></span><div><strong>Accrue Proof Engine</strong><p>Automated evidence review · one of three verifier seats</p></div></div><button className="primary" disabled={digital.busy || !currentSubmission || currentRun?.state === "running"} onClick={() => void doAction(() => digital.verify(job))}>{currentRun?.state === "running" ? "Reviewing evidence…" : currentRun?.report ? "Run review again" : "Run evidence review"}</button></div>}
          <div className="dw-verification-meta">Evidence version {job.chain.version} <span>·</span> {job.chain.passVotes} pass / {job.chain.failVotes} fail votes</div>
          {currentRun?.report && <ProofEngineReport run={currentRun} provider={digital.config?.provider ?? "AI provider"} />}
          {job.chain.status === DigitalWorkStatus.submitted && isVerifier && !alreadyVoted && <div className="dw-human-vote"><h3>Your independent review</h3><p>Open the evidence above and read the report. Your signed vote is bound to this evidence version.</p><Textarea value={voteNotes} onChange={(event) => setVoteNotes(event.target.value)} placeholder="Why does this work pass or fail?" /><div className="milestone-actions"><button className="secondary" disabled={digital.busy || !voteNotes.trim()} onClick={() => void doAction(() => digital.vote(job, false, voteNotes))}>Request changes</button><button className="primary" disabled={digital.busy || !voteNotes.trim()} onClick={() => void doAction(() => digital.vote(job, true, voteNotes))}>Vote pass</button></div></div>}
        </section>
      )}

      {job.chain.status === DigitalWorkStatus.paid && <section className="action-banner"><div><h3>Verified outcome. Payment earned.</h3><p>Two independent pass votes released {formatAmount(job.chain.reward)} {token.symbol} to the worker. Every verifier vote is recorded on-chain.</p></div><Check size={26} /></section>}
      {job.chain.status === DigitalWorkStatus.refunded && <section className="action-banner"><div><h3>Review expired. Reserved funds returned.</h3><p>The payer can withdraw the reward and unused verifier fees. Votes already cast remain paid.</p></div><Clock3 size={26} /></section>}
      {reviewExpired && (job.chain.status === DigitalWorkStatus.funded || job.chain.status === DigitalWorkStatus.submitted || job.chain.status === DigitalWorkStatus.needsChanges) && <section className="action-banner"><div><h3>The review window closed.</h3><p>Anyone can finalize the agreed refund path.</p></div><button className="primary" disabled={digital.busy} onClick={() => void doAction(() => digital.expire(job))}>Finalize refund</button></section>}
      {digital.claimable > 0n && <section className="action-banner"><div><h3>{formatAmount(digital.claimable)} {token.symbol} available</h3><p>Withdraw your earned reward, verifier fee, or returned funds.</p></div><button className="primary" disabled={digital.busy} onClick={() => void doAction(() => digital.withdraw())}>Withdraw</button></section>}
    </>
  );
}
