"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Fingerprint, Layers, ScanSearch, X } from "lucide-react";
import { token } from "@/lib/chain";
import { readOffer, useOffers, type Offer } from "../use-offers";
import { useWallet } from "../wallet-context";
import { useTagGate } from "./tag-gate";

/** Plain summary of what the offer pays and asks for, from its saved draft. */
function summarize(offer: Offer) {
  const d = offer.draft as Record<string, unknown>;
  if (offer.kind === "proof") {
    const policy = (d.policy ?? {}) as Record<string, unknown>;
    const check = policy.type === "webpage" ? `A live web page containing "${String(policy.requiredText)}".`
      : policy.type === "pull_request" ? `A pull request merged into ${String(policy.repository)} on GitHub.`
      : `A deployed API where ${String(policy.endpointPath)} returns ${String(policy.expectedJsonKey)} = ${String(policy.expectedJsonValue)}.`;
    return {
      brief: String(policy.brief ?? ""),
      pay: `${String(d.reward ?? "?")} ${token.symbol}`,
      time: `${Math.round(Number(d.deliveryHours ?? 0) / 24)} days to deliver`,
      done: [check, "Proof Engine and two reviewers check it. Two of three pass votes pay you."],
    };
  }
  const milestones = (d.milestones ?? []) as { title: string; amount: string }[];
  const total = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  return {
    brief: String(d.scope ?? ""),
    pay: `${total.toFixed(2)} ${token.symbol} over ${milestones.length} stage${milestones.length === 1 ? "" : "s"}`,
    time: `${Number(d.days ?? 0)} days`,
    done: milestones.map((m) => `${m.title}: ${m.amount} ${token.symbol}`),
  };
}

/**
 * What someone sees when they open a hiring link: the job, the pay, what
 * counts as done, and one button to take it. Taking it does not commit
 * anyone to anything on chain; the client still has to create and fund it,
 * and the worker still accepts the exact terms before any money moves.
 */
export function OfferModal({ offerToken, onClose }: { offerToken: string; onClose: () => void }) {
  const wallet = useWallet();
  const gate = useTagGate();
  const offers = useOffers();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");
  const [taking, setTaking] = useState(false);
  const [taken, setTaken] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    readOffer(offerToken).then((o) => { if (active) setOffer(o); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "This hiring link could not be opened."); });
    return () => { active = false; };
  }, [offerToken]);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mine = offer && wallet.address?.toLowerCase() === offer.clientAddress.toLowerCase();
  const take = async () => {
    if (!gate.requireTag()) return;
    setTaking(true);
    setError("");
    try {
      await offers.take(offerToken);
      setTaken(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not take this job.");
    } finally {
      setTaking(false);
    }
  };

  const s = offer ? summarize(offer) : null;
  return (
    <div className="receipt-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} tabIndex={-1} className="panel modal-content dialog offer-dialog" role="dialog" aria-modal="true" aria-labelledby="offer-title">
        <div className="offer-head">
          <p className="eyebrow">{offer?.kind === "milestone" ? <><Layers size={13} aria-hidden /> Milestone job</> : <><ScanSearch size={13} aria-hidden /> Proof-checked job</>}</p>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>

        {!offer && !error && <p className="muted">Opening the hiring link…</p>}
        {error && !offer && <div role="alert" className="error-banner">{error}</div>}

        {offer && s && (
          taken ? (
            <div className="offer-taken">
              <CheckCircle2 size={28} aria-hidden />
              <h2 id="offer-title">The job is yours.</h2>
              <p className="muted">
                {offer.clientTag ? `@${offer.clientTag}` : "The client"} has been told. Next they lock the terms on
                chain and fund the escrow. You&apos;ll see &ldquo;Accept the terms&rdquo; on your Home when it&apos;s your turn,
                and you can check the money is there before you start.
              </p>
              <button className="primary" onClick={onClose}>Go to Home</button>
            </div>
          ) : (
            <>
              <h2 id="offer-title">{offer.title}</h2>
              <p className="muted">Posted by {offer.clientTag ? <a className="offer-client" href={`/u/${offer.clientTag}`} target="_blank" rel="noreferrer noopener">@{offer.clientTag}</a> : "a client"}</p>
              {s.brief && <p className="offer-brief">{s.brief}</p>}
              <dl className="offer-facts">
                <div><dt>Pay</dt><dd>{s.pay}</dd></div>
                <div><dt>Time</dt><dd>{s.time}</dd></div>
              </dl>
              <div className="offer-done">
                <span className="mono-label">What counts as done</span>
                <ul>{s.done.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
              <p className="fine-print">
                The pay is locked in an escrow contract before you start. Taking the job only reserves it for you;
                you&apos;ll review and accept the exact terms on chain before any money moves.
              </p>
              {error && <div role="alert" className="error-banner">{error}</div>}
              {offer.status !== "open" ? (
                <p className="offer-closed">{offer.status === "expired" ? "This hiring link has expired." : "Someone has already taken this job."}</p>
              ) : mine ? (
                <p className="offer-closed">This is your own hiring link. Share it with the person you want to hire.</p>
              ) : !wallet.wallet ? (
                <div className="milestone-actions">
                  <button className="primary" disabled={!wallet.available || wallet.connecting} onClick={() => void wallet.connect("create")}><Fingerprint size={15} aria-hidden /> {wallet.connecting ? "Waiting…" : "Create an account to take it"}</button>
                  <button className="secondary" disabled={!wallet.available || wallet.connecting} onClick={() => void wallet.connect("open")}>I have an account</button>
                </div>
              ) : (
                <button className="primary" disabled={taking} onClick={() => void take()}>{taking ? "Taking…" : "Take this job"}</button>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
