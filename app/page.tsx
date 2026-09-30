import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Code2,
  Fingerprint,
  Lock,
  ScanSearch,
  Scale,
  Undo2,
  Users,
  Zap,
} from "lucide-react";
import { Scenarios } from "./landing-scenarios";
import { EscrowVault, MilestoneTrack, ProofPipeline, StepGlyph } from "./landing-illustrations";

// Paul's deployment, as recorded in docs/DIGITAL-WORK.md.
const CONTRACT = "0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07";
const EXPLORER = `https://testnet.monadvision.com/address/${CONTRACT}`;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const steps = [
  {
    n: "01",
    title: "Agree the outcome",
    body: "Describe the deliverable and the check that proves it: text a live page must show, a pull request merged into your repo, or data an API must return. The worker accepts that exact version.",
  },
  {
    n: "02",
    title: "Fund the escrow",
    body: "The client deposits the reward and a reviewer fee pool in AUSD. The worker can see the money is locked before writing a line.",
  },
  {
    n: "03",
    title: "Deliver the evidence",
    body: "The worker submits the page link, the pull request or the deployment. Its fingerprint goes on-chain, so the evidence cannot change after review starts.",
  },
  {
    n: "04",
    title: "Proof, then payment",
    body: "Proof Engine runs the checks and an AI review. Independent reviewers settle anything it is unsure of. At two of three pass votes, the contract pays.",
  },
];

const escrow = [
  {
    icon: Lock,
    title: "Held by code, not by us",
    body: "Funds sit in an escrow contract bound to AUSD at deployment. Accrue never takes custody and cannot move the money.",
  },
  {
    icon: BadgeCheck,
    title: "Earned means earned",
    body: "Once work is approved, the pay is credited to the worker to withdraw. The client cannot claw back an approval.",
  },
  {
    icon: Undo2,
    title: "Unearned money comes home",
    body: "If time runs out, or every party agrees to cancel a milestone job, whatever was never earned goes back to the client.",
  },
  {
    icon: Scale,
    title: "Reviewers are paid to decide",
    body: "Reviewers earn a fee for each decision they make. Nobody is asked to check work for free, and nobody earns without voting.",
  },
];

const flows = [
  {
    id: "proof",
    tag: "Proof-checked job",
    title: "One deliverable. Checked, voted, paid.",
    lead: "For one deliverable with a checkable result: a live web page, a merged pull request, or a working API.",
    Figure: ProofPipeline,
    points: [
      "The worker accepts terms locked by hash, then the client funds the reward and a reviewer fee pool.",
      "Proof Engine runs hard checks and an AI review, and casts its vote only when it is confident.",
      "Two independent reviewers cover the rest. Two of three pass votes pay the worker in full.",
      "Each voter earns a third of the fee pool. After the review deadline, anyone can return unpaid funds to the client.",
    ],
  },
  {
    id: "milestone",
    tag: "Milestone job",
    title: "A bigger project, paid stage by stage.",
    lead: "For work that unfolds over weeks, like a site built from wireframes to launch.",
    Figure: MilestoneTrack,
    points: [
      "The client splits the project into up to twelve milestones, each with its own amount and done-criteria.",
      "Each milestone is approved by the client or by a reviewer both sides name, like a senior engineer.",
      "The reviewer can send work back with notes. Approval credits the worker and the reviewer's fee at once.",
      "Milestones unlock in order. If everyone agrees to stop, or the deadline passes, the client reclaims what was never earned.",
    ],
  },
];

const audiences = [
  {
    icon: Users,
    title: "For clients",
    body: "Hire someone you have never met without paying on faith. Your money moves only when the outcome you defined is proven.",
  },
  {
    icon: Code2,
    title: "For builders",
    body: "Start knowing the money exists. Ship, submit the evidence, and get paid by the contract, not by an invoice you have to chase.",
  },
  {
    icon: ScanSearch,
    title: "For reviewers",
    body: "Earn a fee for checking work against terms both sides already agreed. Your vote and your reasoning are on the record.",
  },
];

export default async function Landing({ searchParams }: { searchParams: SearchParams }) {
  // Invite, job and hiring links that point at "/" still land in the app.
  const params = await searchParams;
  const forward = new URLSearchParams();
  for (const key of ["invite", "job", "proof", "offer"]) {
    const value = params[key];
    if (typeof value === "string") forward.set(key, value);
  }
  if (forward.size > 0) redirect(`/app?${forward}`);

  return (
    <div className="lp">
      <header className="lp-nav">
        {/* Plain anchors throughout: see the note on next/link in workspace.tsx. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">a<span>accrue</span></a>
        <nav aria-label="Page sections">
          <a href="#how">How it works</a>
          <a href="#flows">Escrow flows</a>
          <a href="#scenarios">Scenarios</a>
          <a href="#proof">Proof Engine</a>
          <a href="#hire">Hiring links</a>
          <a href="/jobs">Open jobs</a>
        </nav>
        <a className="primary lp-nav-cta" href="/app">Open app <ArrowRight size={15} aria-hidden /></a>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="lp-kicker">Hiring for digital work <i /> Native escrow on Monad</span>
            <h1>Hire for digital work. <em>Pay when it&apos;s proven done.</em></h1>
            <p>
              Agree the outcome, lock the money in escrow, and let automated checks and
              independent reviewers decide when it is delivered. The contract pays the worker.
              Nobody in between holds your money.
            </p>
            <div className="lp-actions">
              <a className="primary" href="/app">Start hiring <ArrowRight size={16} aria-hidden /></a>
              <a className="secondary" href="/demo.html">See a real paid job <ArrowUpRight size={16} aria-hidden /></a>
            </div>
            <a className="lp-video-link" href="/proof-engine-walkthrough.mp4">Watch the narrated walkthrough</a>
          </div>

          <a className="lp-ledger" href="/demo.html" aria-label="Open the proof trail for paid testnet job 6">
            <div className="lp-ledger-top"><span>Job #6</span><span>Monad testnet</span></div>
            <ol className="lp-ledger-rows">
              <li><Lock size={15} aria-hidden /><span>Terms locked</span><b>policy hash</b></li>
              <li><CheckCircle2 size={15} aria-hidden /><span>Worker accepted</span><b>on-chain</b></li>
              <li><CheckCircle2 size={15} aria-hidden /><span>Escrow funded</span><b>5.30 AUSD</b></li>
              <li><CheckCircle2 size={15} aria-hidden /><span>Evidence submitted</span><b>commit + API</b></li>
              <li><CheckCircle2 size={15} aria-hidden /><span>Reviewer votes</span><b>2 of 3 pass</b></li>
            </ol>
            <div className="lp-ledger-total">
              <strong>5.00</strong>
              <span>AUSD<br />paid to the worker</span>
            </div>
            <div className="lp-ledger-foot">Follow the proof trail <ArrowUpRight size={15} aria-hidden /></div>
          </a>
        </section>

        <section className="lp-section" aria-labelledby="problem">
          <span className="lp-label">The problem</span>
          <h2 id="problem">Remote hiring runs on trust nobody can check.</h2>
          <div className="lp-grid lp-grid-3">
            <article><h3>The client</h3><p>Pays upfront and hopes, or holds back and watches good people walk away.</p></article>
            <article><h3>The builder</h3><p>Starts before knowing the money exists, then spends weeks chasing the invoice.</p></article>
            <article><h3>The marketplace</h3><p>Holds both sides&apos; money, takes a cut, and settles disputes on its own schedule.</p></article>
          </div>
        </section>

        <section className="lp-section" id="how" aria-labelledby="how-title">
          <span className="lp-label">How it works</span>
          <h2 id="how-title">Four steps, and the contract keeps score.</h2>
          <ol className="lp-steps">
            {steps.map((step, i) => (
              <li key={step.n}>
                <StepGlyph step={i} />
                <b>{step.n}</b>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section" id="escrow" aria-labelledby="escrow-title">
          <span className="lp-label">Native escrow</span>
          <h2 id="escrow-title">The escrow is the contract. Not us.</h2>
          <figure className="lp-figure">
            <EscrowVault className="lp-ill" />
          </figure>
          <div className="lp-grid lp-grid-2">
            {escrow.map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <Icon size={20} aria-hidden />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="flows" aria-labelledby="flows-title">
          <span className="lp-label">Two escrow flows</span>
          <h2 id="flows-title">Pick the flow that fits the work.</h2>
          <p className="lp-section-lead">
            Both run on the same rule: money moves only on approval, and what is never
            earned goes back to the client. They differ in who decides and how the pay is split.
          </p>
          <div className="lp-flows">
            {flows.map(({ id, tag, title, lead, Figure, points }) => (
              <article key={id} className="lp-flow">
                <span className="lp-flow-tag">{tag}</span>
                <h3>{title}</h3>
                <p>{lead}</p>
                <Figure className="lp-ill" />
                <ol>
                  {points.map((point) => <li key={point}>{point}</li>)}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="scenarios" aria-labelledby="scenarios-title">
          <span className="lp-label">Scenarios</span>
          <h2 id="scenarios-title">What it looks like when real work happens.</h2>
          <p className="lp-section-lead">
            Four jobs, start to finish, including the ones that go sideways. Every payout
            follows the contract rules exactly.
          </p>
          <Scenarios />
        </section>

        <section className="lp-section lp-split" id="proof" aria-labelledby="proof-title">
          <div>
            <span className="lp-label">Proof Engine</span>
            <h2 id="proof-title">An AI reviewer that knows when to step aside.</h2>
            <p>
              Proof Engine first runs checks that cannot be argued with: does the page load and
              say what was agreed, is the pull request merged into the right repository, does the
              API return the right data. Then an AI model scores the work against the brief.
            </p>
            <p>
              It votes pass only at 90% confidence or higher with little need for human review.
              It votes fail when a check breaks or confidence drops to 10%. Anything in between
              goes to the human reviewers, and the reason is written into the report.
            </p>
          </div>
          <div className="lp-report" aria-label="Proof Engine report for job 6">
            <div className="lp-report-top"><span>Proof Engine / Job #6</span><span>Report</span></div>
            <ul>
              <li><CheckCircle2 size={15} aria-hidden /> Commit found</li>
              <li><CheckCircle2 size={15} aria-hidden /> API responded</li>
              <li><CheckCircle2 size={15} aria-hidden /> JSON matched</li>
            </ul>
            <dl>
              <div><dt>Requirements confidence</dt><dd>94%</dd></div>
              <div><dt>Human review need</dt><dd>15%</dd></div>
            </dl>
            <p className="lp-report-verdict">Above the 10% review limit, so it abstained. Two human reviewers passed the work.</p>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="monad-title">
          <span className="lp-label">Why Monad</span>
          <h2 id="monad-title">Every step is a transaction. That has to be cheap and fast.</h2>
          <div className="lp-grid lp-grid-3">
            <article><Zap size={20} aria-hidden /><h3>Settles in about a second</h3><p>In our testnet runs, funding, votes and withdrawals confirmed in 0.3 to 1.5 seconds. The app shows the time on every transaction, so a verified job feels paid, not pending.</p></article>
            <article><Scale size={20} aria-hidden /><h3>Small jobs make sense</h3><p>Create, accept, fund, submit, three votes, withdraw. Low fees keep a five-dollar task worth putting on-chain.</p></article>
            <article><Fingerprint size={20} aria-hidden /><h3>No crypto homework</h3><p>Sign in with a passkey, no seed phrase or extension. The first network fee is sponsored, and you pay @names, not addresses.</p></article>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="who-title">
          <span className="lp-label">Who it&apos;s for</span>
          <h2 id="who-title">Three roles, each signing for themselves.</h2>
          <div className="lp-grid lp-grid-3">
            {audiences.map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <Icon size={20} aria-hidden />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section lp-split" id="hire" aria-labelledby="hire-title">
          <div>
            <span className="lp-label">Hiring links</span>
            <h2 id="hire-title">Don&apos;t know who to hire yet? Share a link.</h2>
            <p>
              Write the job without naming anyone and Accrue gives you a link. Post it or send it.
              Whoever takes it first sees the brief, the pay and what counts as done before they
              commit.
            </p>
            <p>
              Once someone takes it, your Home says so and the job form is already filled in. You
              create it on chain, they accept the exact terms, you fund. Nothing moves until then.
            </p>
          </div>
          <ol className="lp-hire-steps">
            <li><b>01</b><span>You write the job and get a link</span></li>
            <li><b>02</b><span>Someone opens it and takes the job</span></li>
            <li><b>03</b><span>You create it for them in one click</span></li>
            <li><b>04</b><span>They accept, you fund, work starts</span></li>
          </ol>
        </section>

        <section className="lp-cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Try it before you hire anyone.</h2>
          <p>
            Sign in with a passkey and start the walkthrough: play the client, the worker and the
            reviewer on one device, through a real job on Monad testnet, in about three minutes.
          </p>
          <a className="primary" href="/app">Start the walkthrough <ArrowRight size={16} aria-hidden /></a>
        </section>
      </main>

      <footer className="lp-footer">
        <p>
          <Clock3 size={14} aria-hidden /> Live on Monad testnet with test AUSD. The contracts are
          unaudited and must not hold real funds. Automated checks cover live web pages, merged
          GitHub pull requests and deployed APIs.
        </p>
        <nav aria-label="Proof links">
          <a href={EXPLORER} target="_blank" rel="noreferrer noopener">Contract <ArrowUpRight size={13} aria-hidden /></a>
          <a href="/demo.html">Proof trail</a>
          <a href="/proof-engine-walkthrough.mp4">Walkthrough</a>
        </nav>
      </footer>
    </div>
  );
}
