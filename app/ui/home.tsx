"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Bell,
  Check,
  CheckCircle2,
  Coins,
  Fingerprint,
  Hourglass,
  Layers,
  RefreshCw,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { formatAmount, token } from "@/lib/chain";
import { readDigitalVote } from "@/lib/digital-work-chain";
import { milestoneActions, proofActions, ProofStatus, type JobKind, type NextAction } from "@/lib/next-actions";
import { useDigitalWork } from "../use-digital-work";
import { useLiveAgreements } from "../use-live-agreements";
import { offerUrl, useOffers, type Offer } from "../use-offers";
import { useWallet } from "../wallet-context";
import { useTagGate } from "./tag-gate";
import { DemoGuide, DemoInvite } from "./demo-guide";

/** A hiring link someone took, carried into the builder to become a job. */
export type TakenOffer = { token: string; kind: JobKind; takenBy: string; draft: Record<string, unknown> };

export type HomeIntent =
  | { type: "open"; kind: JobKind; id: string }
  | { type: "create"; kind: JobKind; offer?: TakenOffer; draft?: Record<string, unknown> };

/** One line in "Needs you" or "Waiting on others", from a job or a hiring link. */
type Row = { key: string; owner: "you" | "waiting"; meta: string; action: string; detail: string; cta: string; onOpen: () => void };

/**
 * The first screen after sign-in: what needs this person, what they are
 * waiting on, how to start, and where their money is. Both escrow types feed
 * one list, so nobody has to check two pages to find out what to do next.
 */
export function Home({ onIntent, onCount }: { onIntent: (intent: HomeIntent) => void; onCount?: (count: number) => void }) {
  const wallet = useWallet();
  if (!wallet.wallet) return <SignInCard />;
  return <SignedInHome onIntent={onIntent} onCount={onCount} />;
}

const REFRESH_MS = 90_000;

export function SignInCard() {
  const wallet = useWallet();
  return (
    <section className="home-signin" aria-labelledby="home-signin-title">
      <span className="eyebrow">Accrue workspace</span>
      <h1 id="home-signin-title">Sign in to hire or get paid.</h1>
      <p>
        Your account is a passkey on this device. No password, no seed phrase, no
        browser extension.
      </p>
      <div className="home-signin-actions">
        <button className="primary" disabled={!wallet.available || wallet.connecting} onClick={() => void wallet.connect("create")}>
          <Fingerprint size={16} aria-hidden /> {wallet.connecting ? "Waiting for passkey…" : "Create an account"}
        </button>
        <button className="secondary" disabled={!wallet.available || wallet.connecting} onClick={() => void wallet.connect("open")}>
          I already have one
        </button>
      </div>
      {!wallet.available && <p className="muted">This browser cannot create passkeys. Try a recent Chrome, Safari or Edge.</p>}
      {wallet.error && (
        <div role="alert" className="error-banner">
          {wallet.error}
          <button className="text-button" onClick={() => wallet.setError("")}>Dismiss</button>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="home-signin-back" href="/">New here? See how Accrue works <ArrowRight size={14} aria-hidden /></a>
    </section>
  );
}

function SignedInHome({ onIntent, onCount }: { onIntent: (intent: HomeIntent) => void; onCount?: (count: number) => void }) {
  const wallet = useWallet();
  const gate = useTagGate();
  const digital = useDigitalWork();
  const live = useLiveAgreements();
  const offers = useOffers();
  const [copiedOffer, setCopiedOffer] = useState<string | null>(null);
  const me = wallet.address;
  const tag = wallet.tags[wallet.role];
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  // A verifier should only be asked to vote once per submitted version, and
  // the vote lives on-chain, so read it for the jobs where it matters.
  useEffect(() => {
    if (!me) return;
    const pending = digital.jobs.filter((job) => job.chain.status === ProofStatus.submitted &&
      job.verifiers.some((v) => v.toLowerCase() === me.toLowerCase()));
    if (!pending.length) return;
    let cancelled = false;
    void Promise.all(pending.map(async (job) => {
      const vote = await readDigitalVote(BigInt(job.onchainId), me).catch(() => null);
      return [job.id, vote ? vote.version === job.chain.version : false] as const;
    })).then((entries) => { if (!cancelled) setVotes(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [digital.jobs, me]);

  const actions = useMemo(() => {
    const list: NextAction[] = [];
    for (const job of digital.jobs) {
      list.push(...proofActions({
        id: job.id,
        title: job.title,
        payer: job.payer,
        worker: job.worker,
        verifiers: job.verifiers,
        status: job.chain.status,
        workerAccepted: job.chain.workerAccepted,
        deliveryDeadline: job.chain.deliveryDeadline,
        reviewDeadline: job.chain.reviewDeadline,
        votedCurrentVersion: job.id in votes ? votes[job.id] : null,
      }, me, now));
    }
    for (const a of live.agreements) {
      list.push(...milestoneActions({
        id: a.id,
        title: a.title,
        payer: a.payer,
        worker: a.worker,
        verifier: a.chain.verifier,
        // Reviewer-approved whenever a reviewer is named, whatever the fee:
        // that is how the builder sets externalVerifier on every milestone.
        milestones: a.milestones.map((m) => ({ title: m.title, external: !/^0x0{40}$/i.test(a.chain.verifier) })),
        states: a.states,
        acceptances: a.chain.acceptances,
        funded: a.chain.funded,
        cancelled: a.chain.cancelled,
        expiry: a.chain.expiry,
        reserved: a.chain.reserved,
        nextMilestone: Number(a.chain.nextMilestone),
        workerEarned: a.chain.workerEarned,
        workerWithdrawn: a.chain.workerWithdrawn,
        verifierEarned: a.chain.verifierEarned,
        verifierWithdrawn: a.chain.verifierWithdrawn,
      }, me, now));
    }
    return list;
  }, [digital.jobs, live.agreements, me, now, votes]);

  const jobRow = (a: NextAction): Row => ({
    key: a.key, owner: a.owner, meta: `${a.kind === "proof" ? "Proof-checked" : "Milestone"} · ${a.title}`,
    action: a.action, detail: a.detail, cta: "Open", onOpen: () => onIntent({ type: "open", kind: a.kind, id: a.jobId }),
  });

  // Hiring links move the other way: the client acts once someone takes one.
  const offerRow = (o: Offer): Row | null => {
    const kindLabel = o.kind === "proof" ? "Hiring link · proof-checked" : "Hiring link · milestone";
    const taker = o.takerTag ? `@${o.takerTag}` : "Someone";
    if (o.viewer === "client" && o.status === "taken") {
      // The worker is fixed on chain at creation, so it goes into the draft now.
      const draft = o.kind === "proof"
        ? { ...o.draft, worker: o.takerAddress ?? "" }
        : { ...o.draft, workerTag: o.takerTag ?? o.takerAddress ?? "" };
      return {
        key: `offer:${o.token}`, owner: "you", meta: `${kindLabel} · ${o.title}`,
        action: `Create the job for ${taker}`,
        detail: `${taker} took your hiring link. Create the job so they can accept the terms, then fund it.`,
        cta: "Create", onOpen: () => onIntent({ type: "create", kind: o.kind, offer: { token: o.token, kind: o.kind, takenBy: taker, draft } }),
      };
    }
    if (o.viewer === "client" && o.status === "open")
      return {
        key: `offer:${o.token}`, owner: "waiting", meta: `${kindLabel} · ${o.title}`,
        action: "Hiring link is open", detail: "Nobody has taken it yet. Copy the link to share it again.",
        cta: copiedOffer === o.token ? "Copied" : "Copy link",
        onOpen: () => { void navigator.clipboard.writeText(offerUrl(o.token)).then(() => setCopiedOffer(o.token)); },
      };
    if (o.viewer === "taker" && o.status === "taken")
      return {
        key: `offer:${o.token}`, owner: "waiting", meta: `${kindLabel} · ${o.title}`,
        action: `Waiting for ${o.clientTag ? `@${o.clientTag}` : "the client"} to create the job`,
        detail: "You took this job. Once the client locks the terms on chain, you'll be asked to accept them here.",
        cta: "", onOpen: () => undefined,
      };
    return null;
  };

  const rows = [...offers.offers.map(offerRow).filter((r): r is Row => r !== null), ...actions.map(jobRow)];
  const yours = rows.filter((r) => r.owner === "you");
  const waiting = rows.filter((r) => r.owner === "waiting");
  const yourKeys = yours.map((r) => r.key).join("|");
  const listLoading = digital.loading || live.loading || offers.loading;

  // Keep the list current while Home is open, so a turn that arrives while
  // someone waits shows up without them reloading.
  const { refresh: refreshDigital } = digital;
  const { refresh: refreshLive } = live;
  const { refresh: refreshOffers } = offers;
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshDigital();
      void refreshLive();
      void refreshOffers();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshDigital, refreshLive, refreshOffers]);

  // Report the count to the shell (nav badge, tab title), and raise a
  // browser alert for anything new while the tab is in the background.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    onCount?.(yours.length);
    const keys = new Set(yourKeys ? yourKeys.split("|") : []);
    if (seen.current && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const fresh = yours.filter((r) => !seen.current!.has(r.key));
      if (fresh.length)
        new Notification(fresh.length === 1 ? fresh[0].action : `${fresh.length} things need you on Accrue`, {
          body: fresh.length === 1 ? fresh[0].meta : fresh.map((r) => r.action).join(" · "),
          tag: "accrue-needs-you",
        });
    }
    if (!listLoading) seen.current = keys;
    // yourKeys stands in for the list's identity; yours itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourKeys, listLoading, onCount]);

  const [alerts, setAlerts] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const jobCount = digital.jobs.length + live.agreements.length + offers.offers.length;
  const loading = digital.loading || live.loading;

  const lower = me?.toLowerCase();
  const inEscrow =
    digital.jobs.filter((j) => j.payer.toLowerCase() === lower && (j.chain.status === ProofStatus.funded ||
      j.chain.status === ProofStatus.submitted || j.chain.status === ProofStatus.needsChanges))
      .reduce((sum, j) => sum + j.chain.reward + j.chain.remainingFees, 0n) +
    live.agreements.filter((a) => a.payer.toLowerCase() === lower).reduce((sum, a) => sum + a.chain.reserved, 0n);
  const milestoneOwed = live.agreements.reduce((sum, a) => {
    if (a.worker.toLowerCase() === lower) sum += a.chain.workerEarned - a.chain.workerWithdrawn;
    if (a.verifier.toLowerCase() === lower) sum += a.chain.verifierEarned - a.chain.verifierWithdrawn;
    return sum;
  }, 0n);
  const withdrawable = digital.claimable + milestoneOwed;

  const steps = [
    { done: !!tag, label: "Claim your @name", hint: "People pay and invite @names, not 42-character addresses.", icon: AtSign,
      run: () => gate.requireTag(), cta: "Choose a name" },
    { done: (wallet.ausdBalance ?? 0n) > 0n, label: `Get test ${token.symbol}`, hint: "Free testnet dollars, so you can fund a job end to end.", icon: Coins,
      run: async () => {
        setClaiming(true);
        setClaimError("");
        try { await wallet.requestTestTokens(); await wallet.refresh(); }
        catch (e) { setClaimError(e instanceof Error ? e.message : "Could not claim test tokens."); }
        finally { setClaiming(false); }
      }, cta: claiming ? "Claiming…" : "Claim test funds" },
    { done: jobCount > 0, label: "Start or join your first job", hint: "Create one below, or open an invite link someone sent you.", icon: Sparkles,
      run: () => document.getElementById("home-start")?.scrollIntoView({ behavior: "smooth", block: "start" }), cta: "Pick a job type" },
  ];
  const setupDone = steps.every((s) => s.done);

  const start = (kind: JobKind) => { if (gate.requireTag()) onIntent({ type: "create", kind }); };

  return (
    <div className="home">
      <header className="home-greeting">
        <div>
          <span className="eyebrow">Home</span>
          <h1>{tag ? `Welcome back, @${tag.tag}.` : "Welcome to Accrue."}</h1>
          <p className="muted">
            {loading ? "Reading your jobs from Monad…"
              : yours.length ? `${yours.length} ${yours.length === 1 ? "thing needs" : "things need"} you.`
              : jobCount ? "Nothing needs you right now."
              : "Hire someone, or get paid for work, with the money held in escrow."}
          </p>
        </div>
        <div className="home-greeting-actions">
          {alerts === "default" && (
            <button className="text-button" onClick={() => { void Notification.requestPermission().then(setAlerts); }}>
              <Bell size={14} aria-hidden /> Alert me when it&apos;s my turn
            </button>
          )}
          <button className="text-button" onClick={() => { void digital.refresh(); void live.refresh(); void offers.refresh(); void wallet.refresh(); }} disabled={loading}>
            <RefreshCw size={14} aria-hidden className={loading ? "spin" : undefined} /> Refresh
          </button>
        </div>
      </header>

      {wallet.demoRoles && <DemoGuide agreements={live.agreements} onIntent={onIntent} />}

      <section className="home-balances" aria-label="Your money">
        <div><span>Wallet</span><strong>{wallet.ausdBalance === null ? "—" : formatAmount(wallet.ausdBalance)}</strong><small>{token.symbol} you can spend</small></div>
        <div><span>Locked in escrow</span><strong>{formatAmount(inEscrow)}</strong><small>{token.symbol} you funded, not yet paid out</small></div>
        <div className={withdrawable > 0n ? "home-balance-ready" : undefined}>
          <span>Ready to withdraw</span><strong>{formatAmount(withdrawable)}</strong><small>{token.symbol} earned and waiting for you</small>
        </div>
      </section>

      {!setupDone && !wallet.demoRoles && (
        <section className="home-panel" aria-labelledby="home-setup-title">
          <div className="home-panel-head">
            <h2 id="home-setup-title">Get set up</h2>
            <span className="muted">{steps.filter((s) => s.done).length} of {steps.length} done</span>
          </div>
          <ol className="home-setup">
            {steps.map(({ done, label, hint, icon: Icon, run, cta }) => (
              <li key={label} className={done ? "done" : undefined}>
                <span className="home-setup-icon" aria-hidden>{done ? <Check size={16} /> : <Icon size={16} />}</span>
                <div><b>{label}</b><p>{hint}</p></div>
                {done ? <span className="home-setup-done">Done</span>
                  : <button className="secondary" onClick={() => void run()} disabled={claiming && cta.startsWith("Claim")}>{cta}</button>}
              </li>
            ))}
          </ol>
          {claimError && <div role="alert" className="error-banner">{claimError}<button className="text-button" onClick={() => setClaimError("")}>Dismiss</button></div>}
        </section>
      )}

      <section className="home-panel" aria-labelledby="home-you-title">
        <div className="home-panel-head">
          <h2 id="home-you-title">Needs you</h2>
          {yours.length > 0 && <span className="badge">{yours.length}</span>}
        </div>
        {(digital.error || live.error) && (
          <div role="alert" className="error-banner">
            {digital.error || live.error}
            <button className="text-button" onClick={() => { digital.setError(""); live.setError(""); void digital.refresh(); void live.refresh(); }}>Retry</button>
          </div>
        )}
        {loading && !actions.length ? (
          <ul className="home-actions" aria-busy="true">
            {[0, 1].map((i) => <li key={i} className="home-skeleton" />)}
          </ul>
        ) : yours.length ? (
          <ul className="home-actions">
            {yours.map((r) => <ActionRow key={r.key} row={r} />)}
          </ul>
        ) : (
          <div className="home-empty">
            <CheckCircle2 size={20} aria-hidden />
            <p>{jobCount ? "You're all caught up. We'll list anything that needs your signature here." : "When a job needs you to accept, fund, deliver, review or withdraw, it shows up here."}</p>
          </div>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="home-panel" aria-labelledby="home-waiting-title">
          <div className="home-panel-head">
            <h2 id="home-waiting-title">Waiting on others</h2>
            <span className="muted">{waiting.length}</span>
          </div>
          <ul className="home-actions">
            {waiting.map((r) => <ActionRow key={r.key} row={r} />)}
          </ul>
        </section>
      )}

      <section className="home-panel" id="home-start" aria-labelledby="home-start-title">
        <div className="home-panel-head"><h2 id="home-start-title">Start a job</h2></div>
        <div className="home-start">
          <button className="home-start-card" onClick={() => start("proof")} disabled={!digital.config?.contractAddress || !digital.config?.jevAddress}>
            <ScanSearch size={22} aria-hidden />
            <b>Proof-checked job</b>
            <p>One deliverable with a testable outcome, like an API. Automated checks and two reviewers decide, and payment releases on two of three pass votes.</p>
            <span>{digital.config && (!digital.config.contractAddress || !digital.config.jevAddress) ? "Not configured on this deployment" : "Create"} <ArrowRight size={14} aria-hidden /></span>
          </button>
          <button className="home-start-card" onClick={() => start("milestone")}>
            <Layers size={22} aria-hidden />
            <b>Milestone job</b>
            <p>A bigger project paid in stages. You, or a reviewer you both trust, approve each milestone, and each approval releases its payment.</p>
            <span>Create <ArrowRight size={14} aria-hidden /></span>
          </button>
        </div>
      </section>

      {!wallet.demoRoles && <DemoInvite />}
    </div>
  );
}

function ActionRow({ row }: { row: Row }) {
  const body = (
    <>
      <span className="home-action-icon" aria-hidden>{row.owner === "you" ? <ArrowRight size={16} /> : <Hourglass size={16} />}</span>
      <span className="home-action-body">
        <span className="home-action-meta">{row.meta}</span>
        <b>{row.action}</b>
        <span className="home-action-detail">{row.detail}</span>
      </span>
      {row.cta && <span className="home-action-cta">{row.cta}</span>}
    </>
  );
  return (
    <li>
      {row.cta
        ? <button className={`home-action home-action-${row.owner}`} onClick={row.onOpen}>{body}</button>
        : <div className={`home-action home-action-${row.owner}`}>{body}</div>}
    </li>
  );
}
