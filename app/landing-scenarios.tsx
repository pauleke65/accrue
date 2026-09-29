"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, CheckCircle2, Coins, FileSignature, RotateCcw, ScanSearch, Send, Undo2, UserCheck, XCircle } from "lucide-react";

// Payouts follow the contracts: a proof-checked job pays each voter a third of
// the fee pool and returns unearned fees to the client on settlement; a
// milestone job credits worker pay and reviewer fee on each approval and lets
// the client reclaim what is still reserved after expiry or mutual cancellation.

type Kind = "terms" | "fund" | "submit" | "check" | "vote" | "changes" | "paid" | "refund" | "idle";

type Scenario = {
  id: string;
  tab: string;
  flow: "Proof-checked job" | "Milestone job";
  real?: boolean;
  title: string;
  who: string;
  facts: [string, string][];
  events: { kind: Kind; actor: string; text: string; money?: string }[];
  outcome: [string, string][];
  lesson: string;
};

const scenarios: Scenario[] = [
  {
    id: "api",
    tab: "The API integration",
    flow: "Proof-checked job",
    title: "A founder hires a developer she has never met.",
    who: "Amara runs a remittance startup. She needs a /rates endpoint that returns live exchange rates, and hires Kofi, a backend developer two countries away.",
    facts: [["Reward", "400 AUSD"], ["Reviewer fees", "30 AUSD"], ["Reviewers", "Proof Engine + 2 people"]],
    events: [
      { kind: "terms", actor: "Amara", text: "Writes the brief and the test: GET /rates must return 200 with a \"base\" of \"USD\". The terms are hashed." },
      { kind: "terms", actor: "Kofi", text: "Reads the exact terms and accepts them on-chain." },
      { kind: "fund", actor: "Amara", text: "Funds the escrow. Kofi can see the money is locked before he starts.", money: "−430" },
      { kind: "submit", actor: "Kofi", text: "Submits his commit and the live deployment. The evidence fingerprint is recorded." },
      { kind: "check", actor: "Proof Engine", text: "Commit found, API responds, JSON matches. The AI scores 96% confidence with 4% review need, so it votes pass." },
      { kind: "vote", actor: "Reviewer 1", text: "Tests the endpoint independently and votes pass. That makes two of three." },
      { kind: "paid", actor: "Contract", text: "Settles instantly. Kofi's reward is his to withdraw.", money: "+400" },
    ],
    outcome: [["Kofi", "400 AUSD"], ["Proof Engine", "10 AUSD"], ["Reviewer 1", "10 AUSD"], ["Back to Amara", "10 AUSD"]],
    lesson: "The third reviewer never had to act, so their share of the fee went back to Amara.",
  },
  {
    id: "abstain",
    tab: "When the AI isn't sure",
    flow: "Proof-checked job",
    real: true,
    title: "The AI stepped aside, and people decided.",
    who: "This one happened on Monad testnet as job #6. The checks all passed, but the model wasn't sure enough the brief was fully met.",
    facts: [["Reward", "5.00 AUSD"], ["Reviewer fees", "0.30 AUSD"], ["Reviewers", "Proof Engine + 2 people"]],
    events: [
      { kind: "terms", actor: "Client", text: "Locks the terms and names three distinct verifier addresses." },
      { kind: "fund", actor: "Client", text: "Funds reward and fee pool after the worker accepts.", money: "−5.30" },
      { kind: "submit", actor: "Worker", text: "Submits a commit and a live API deployment." },
      { kind: "check", actor: "Proof Engine", text: "All three checks pass. 94% confidence, but 15% human-review need is above the 10% limit, so it abstains instead of guessing." },
      { kind: "vote", actor: "Reviewer 1", text: "Reads the report, checks the work, votes pass." },
      { kind: "vote", actor: "Reviewer 2", text: "Votes pass. Two of three reached." },
      { kind: "paid", actor: "Contract", text: "Pays the worker and closes the job.", money: "+5.00" },
    ],
    outcome: [["Worker", "5.00 AUSD"], ["Reviewer 1", "0.10 AUSD"], ["Reviewer 2", "0.10 AUSD"], ["Back to client", "0.10 AUSD"]],
    lesson: "An AI that abstains is a feature. Money never moved on a guess, and the engine earned nothing for not voting.",
  },
  {
    id: "website",
    tab: "The website rebuild",
    flow: "Milestone job",
    title: "A shop owner pays for a site in four stages.",
    who: "Tobi owns a furniture business and hires Zainab to rebuild his online store. Neither can judge code, so they name Chidi, a senior engineer, as reviewer.",
    facts: [["Milestones", "4"], ["Worker pay", "1,200 AUSD"], ["Reviewer fees", "20 AUSD per milestone"]],
    events: [
      { kind: "terms", actor: "Tobi", text: "Sets four milestones: wireframes 200, build 600, launch 300, handover 100, each with done-criteria." },
      { kind: "terms", actor: "Zainab + Chidi", text: "Both accept the same terms. Funding is blocked until they do." },
      { kind: "fund", actor: "Tobi", text: "Funds the whole project into escrow.", money: "−1,280" },
      { kind: "paid", actor: "Chidi", text: "Approves the wireframes. Zainab and Chidi are credited in the same transaction.", money: "+220" },
      { kind: "changes", actor: "Chidi", text: "Sends the build back: the checkout breaks on mobile. The notes are recorded, and no money moves." },
      { kind: "paid", actor: "Chidi", text: "Approves the fixed build.", money: "+620" },
      { kind: "paid", actor: "Chidi", text: "Approves launch, then handover.", money: "+440" },
    ],
    outcome: [["Zainab", "1,200 AUSD"], ["Chidi", "80 AUSD"], ["Back to Tobi", "0 AUSD"]],
    lesson: "Zainab was paid as she went, not at the end. Tobi never paid for a stage his reviewer hadn't signed off.",
  },
  {
    id: "stalled",
    tab: "The project that stalled",
    flow: "Milestone job",
    title: "A writer goes quiet halfway through.",
    who: "Ngozi commissions three articles from a freelance writer and approves each one herself, so there is no outside reviewer and no fee.",
    facts: [["Milestones", "3 articles"], ["Worker pay", "450 AUSD"], ["Approver", "Ngozi herself"]],
    events: [
      { kind: "terms", actor: "Ngozi", text: "Sets three milestones of 150 each, with a deadline." },
      { kind: "fund", actor: "Ngozi", text: "Funds after the writer accepts.", money: "−450" },
      { kind: "paid", actor: "Ngozi", text: "Approves the first article. The writer's 150 is theirs from here on.", money: "+150" },
      { kind: "idle", actor: "Writer", text: "Stops responding. Articles two and three never arrive." },
      { kind: "refund", actor: "Ngozi", text: "Once the deadline passes, she reclaims everything not yet earned. No support ticket, no dispute form.", money: "+300" },
    ],
    outcome: [["Writer", "150 AUSD"], ["Back to Ngozi", "300 AUSD"]],
    lesson: "Nobody loses what they earned, and nobody pays for what never arrived. If both sides agree to stop early, they can cancel before the deadline too.",
  },
];

const icons: Record<Kind, typeof CheckCircle2> = {
  terms: FileSignature,
  fund: Coins,
  submit: Send,
  check: ScanSearch,
  vote: UserCheck,
  changes: RotateCcw,
  paid: CheckCircle2,
  refund: Undo2,
  idle: XCircle,
};

export function Scenarios() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = scenarios[active];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = scenarios.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? (active === last ? 0 : active + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (active === 0 ? last : active - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="lp-scenarios">
      <div className="lp-scenario-tabs" role="tablist" aria-label="Scenarios" onKeyDown={onKeyDown}>
        {scenarios.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => { tabs.current[i] = el; }}
            role="tab"
            id={`scenario-tab-${item.id}`}
            aria-selected={i === active}
            aria-controls={`scenario-panel-${item.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
          >
            <span>{item.flow}{item.real ? " · real" : ""}</span>
            {item.tab}
          </button>
        ))}
      </div>

      <div
        className="lp-scenario"
        role="tabpanel"
        id={`scenario-panel-${s.id}`}
        aria-labelledby={`scenario-tab-${s.id}`}
        key={s.id}
      >
        <div className="lp-scenario-intro">
          <div className="lp-scenario-tags">
            <span className="lp-flow-tag">{s.flow}</span>
            {s.real
              ? <a className="lp-real-tag" href="/demo.html">Real testnet job <ArrowUpRight size={12} aria-hidden /></a>
              : <span className="lp-example-tag">Illustrative example</span>}
          </div>
          <h3>{s.title}</h3>
          <p>{s.who}</p>
          <dl className="lp-scenario-facts">
            {s.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>

        <ol className="lp-timeline">
          {s.events.map((event, i) => {
            const Icon = icons[event.kind];
            return (
              <li key={i} className={`lp-event lp-event-${event.kind}`}>
                <span className="lp-event-icon"><Icon size={15} aria-hidden /></span>
                <div>
                  <b>{event.actor}</b>
                  <p>{event.text}</p>
                </div>
                {event.money && <span className="lp-event-money">{event.money}</span>}
              </li>
            );
          })}
        </ol>

        <div className="lp-scenario-outcome">
          <span className="lp-label">Where the money went</span>
          <dl>
            {s.outcome.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p>{s.lesson}</p>
        </div>
      </div>
    </div>
  );
}
