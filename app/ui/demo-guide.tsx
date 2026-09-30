"use client";

import { useState } from "react";
import { Check, Coins, Handshake, PlayCircle, Send, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { formatAmount, parseAmount, token } from "@/lib/chain";
import type { Role } from "@/lib/mera-account";
import type { LiveAgreement } from "../use-live-agreements";
import { useWallet } from "../wallet-context";
import type { HomeIntent } from "./home";

/**
 * A guided run through one whole milestone job, playing every role.
 *
 * One passkey derives a client, a worker and a reviewer account, so a single
 * visitor (a judge, say) can see both sides of the escrow without a second
 * device. Progress is read from the job's real on-chain state, not ticked
 * off by the guide, so a step only shows done once the contract agrees.
 *
 * It uses a milestone job because a proof-checked job needs two human
 * reviewers besides the client and worker, one more account than the
 * walkthrough derives.
 */

const roleName: Record<Role, string> = { payer: "client", worker: "worker", verifier: "reviewer" };

/** A small two-stage job between the walkthrough's own three accounts. */
function demoDraft(worker: string, reviewer: string) {
  return {
    title: "Walkthrough: publish a landing page",
    scope: "Write and publish a one-page landing site for a new product. A walkthrough job between your own three accounts.",
    workerTag: worker,
    verifierTag: reviewer,
    days: 7,
    milestones: [
      { title: "First draft", criteria: "A shareable draft of the page with the headline, three benefits and a sign-up button.", amount: "1.00", fee: "0.10" },
      { title: "Published", criteria: "The page is live on a public URL, works on a phone, and the sign-up button records an email.", amount: "1.00", fee: "0.10" },
    ],
  };
}

export function DemoInvite() {
  const wallet = useWallet();
  return (
    <section className="home-panel demo-invite" aria-labelledby="demo-invite-title">
      <PlayCircle size={22} aria-hidden />
      <div>
        <h2 id="demo-invite-title">See the whole flow in three minutes</h2>
        <p className="muted">
          Play the client, the worker and the reviewer yourself, on one device, with a couple of test
          dollars. Every step is a real transaction on Monad testnet.
        </p>
      </div>
      <button className="secondary" onClick={() => wallet.setDemoRoles(true)}>Start the walkthrough</button>
    </section>
  );
}

export function DemoGuide({ agreements, onIntent }: { agreements: LiveAgreement[]; onIntent: (intent: HomeIntent) => void }) {
  const wallet = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [problem, setProblem] = useState("");
  const accounts = wallet.wallet!.addresses;
  const lower = (a: string) => a.toLowerCase();

  // The most recent job between exactly these three accounts.
  const job = agreements
    .filter((a) => lower(a.payer) === lower(accounts.payer) && lower(a.worker) === lower(accounts.worker) &&
      lower(a.verifier) === lower(accounts.verifier))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  const clientFunds = wallet.balances.payer ?? 0n;
  const needed = parseAmount("2.20"); // both stages plus both review fees
  // The contract wants all three to accept; go through whoever hasn't yet.
  const bit: Record<Role, number> = { payer: 1, worker: 2, verifier: 4 };
  const nextToAccept = (["payer", "worker", "verifier"] as Role[]).find((r) => !job || (job.chain.acceptances & bit[r]) === 0) ?? "payer";

  const steps: { role: Role; icon: typeof Coins; title: string; detail: string; done: boolean; run: () => void | Promise<void>; cta: string }[] = [
    {
      role: "payer", icon: Coins, title: "Get test money for the client",
      detail: `The client needs ${formatAmount(needed)} ${token.symbol} to fund the job. Test money is free.`,
      done: clientFunds >= needed || !!job?.chain.funded,
      cta: claiming ? "Claiming…" : "Claim test funds",
      run: async () => {
        setClaiming(true);
        setProblem("");
        try { await wallet.requestTestTokens(); await wallet.refresh(); }
        catch (e) { setProblem(e instanceof Error ? e.message : "Could not claim test funds."); }
        finally { setClaiming(false); }
      },
    },
    {
      role: "payer", icon: Sparkles, title: "As the client, write the job",
      detail: "Two stages, worker and reviewer already filled in with your other two accounts. Read it, then create it.",
      done: !!job, cta: "Open the job form",
      run: () => onIntent({ type: "create", kind: "milestone", draft: demoDraft(accounts.worker, accounts.verifier) }),
    },
    {
      role: nextToAccept, icon: Handshake, title: "Everyone accepts the terms",
      detail: `Nobody can fund a job until the client, the worker and the reviewer have each agreed to the exact terms. Accept as the ${roleName[nextToAccept]} now.`,
      done: !!job && job.chain.acceptances === 7, cta: "Open the job",
      run: () => job && onIntent({ type: "open", kind: "milestone", id: job.id }),
    },
    {
      role: "payer", icon: Wallet, title: "As the client, fund the escrow",
      detail: "The money moves into the contract, not to Accrue and not to the worker. The worker can now see it is there.",
      done: !!job?.chain.funded, cta: "Open the job",
      run: () => job && onIntent({ type: "open", kind: "milestone", id: job.id }),
    },
    {
      role: "worker", icon: Send, title: "As the worker, submit the first stage",
      detail: "Add a note or a link as evidence. Its fingerprint goes on chain.",
      done: !!job && (job.states[0] ?? 0) >= 1, cta: "Open the job",
      run: () => job && onIntent({ type: "open", kind: "milestone", id: job.id }),
    },
    {
      role: "verifier", icon: ShieldCheck, title: "As the reviewer, approve it",
      detail: "Approval credits the worker and the reviewer's fee in one transaction. The client can't take it back.",
      done: !!job && job.states[0] === 2, cta: "Open the job",
      run: () => job && onIntent({ type: "open", kind: "milestone", id: job.id }),
    },
    {
      role: "worker", icon: Wallet, title: "As the worker, withdraw your pay",
      detail: "Earned money is the worker's to take out. The second stage's money is still safely locked.",
      done: !!job && job.chain.workerWithdrawn > 0n, cta: "Open the job",
      run: () => job && onIntent({ type: "open", kind: "milestone", id: job.id }),
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  const finished = current === -1;

  return (
    <section className="home-panel demo-guide" aria-labelledby="demo-guide-title">
      <div className="home-panel-head">
        <h2 id="demo-guide-title">Walkthrough: play every role</h2>
        <button className="text-button" onClick={() => wallet.setDemoRoles(false)}><X size={14} aria-hidden /> Exit walkthrough</button>
      </div>
      <p className="demo-guide-now">
        You are acting as the <b>{roleName[wallet.role]}</b>. {finished
          ? "That's the whole loop."
          : steps[current].role === wallet.role
            ? "This step is yours."
            : `The next step is for the ${roleName[steps[current].role]}.`}
      </p>
      {problem && <div role="alert" className="error-banner">{problem}<button className="text-button" onClick={() => setProblem("")}>Dismiss</button></div>}
      <ol className="demo-steps">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const active = i === current;
          return (
            <li key={step.title} className={step.done ? "done" : active ? "active" : undefined} aria-current={active ? "step" : undefined}>
              <span className="demo-step-icon" aria-hidden>{step.done ? <Check size={15} /> : <Icon size={15} />}</span>
              <div>
                <b>{step.title}</b>
                {active && <p>{step.detail}</p>}
              </div>
              {active && (
                step.role !== wallet.role
                  ? <button className="secondary" onClick={() => wallet.setRole(step.role)}>Switch to {roleName[step.role]}</button>
                  : <button className="primary" disabled={claiming} onClick={() => void step.run()}>{step.cta}</button>
              )}
            </li>
          );
        })}
      </ol>
      {finished && (
        <p className="demo-guide-done">
          You&apos;ve seen the whole loop: terms agreed, money locked, work approved, pay withdrawn, and the rest
          still protected. Exit the walkthrough to use Accrue as one account again.
        </p>
      )}
    </section>
  );
}
