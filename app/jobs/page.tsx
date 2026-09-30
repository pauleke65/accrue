import { ArrowRight, BriefcaseBusiness, Code2, FileText, GitPullRequest, Layers } from "lucide-react";
import { token } from "@/lib/chain";
import { loadBoard, type BoardJob } from "@/lib/job-board";

// Plain anchors throughout: see the note on next/link in app/workspace.tsx.

const kindLabel = (job: BoardJob) =>
  job.kind === "milestone" ? `Milestone job · ${job.stages} ${job.stages === 1 ? "stage" : "stages"}`
  : job.deliverable === "webpage" ? "Proof-checked · live web page"
  : job.deliverable === "pull_request" ? "Proof-checked · merged pull request"
  : "Proof-checked · working API";

const kindIcon = (job: BoardJob) =>
  job.kind === "milestone" ? Layers : job.deliverable === "webpage" ? FileText : job.deliverable === "pull_request" ? GitPullRequest : Code2;

// Live data on every request: open jobs and on-chain records change constantly.
export const dynamic = "force-dynamic";

export default async function JobBoard() {
  const jobs = await loadBoard().catch(() => null);
  return (
    <div className="lp">
      <header className="lp-nav">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">a<span>accrue</span></a>
        <a className="primary lp-nav-cta" href="/app">Open app <ArrowRight size={15} aria-hidden /></a>
      </header>
      <main className="profile">
        <section className="profile-head">
          <span className="lp-kicker"><BriefcaseBusiness size={14} aria-hidden /> Job board</span>
          <h1>Open jobs</h1>
          <p>
            Every job here pays through escrow: the client locks the money before you start, and it is
            released when the work is approved. Open one to see exactly what counts as done.
          </p>
        </section>
        {jobs === null ? (
          <div className="profile-empty"><p>The job board could not be loaded. Try again in a moment.</p></div>
        ) : jobs.length === 0 ? (
          <div className="profile-empty"><p>No open jobs right now. Clients can list one when they create a hiring link.</p></div>
        ) : (
          <ol className="board">
            {jobs.map((job) => {
              const Icon = kindIcon(job);
              return (
                <li key={job.token}>
                  <a href={`/app?offer=${job.token}`}>
                    <span className="board-kind"><Icon size={14} aria-hidden /> {kindLabel(job)}</span>
                    <b>{job.title}</b>
                    <p>{job.brief.length > 180 ? `${job.brief.slice(0, 180)}…` : job.brief}</p>
                    <span className="board-meta">
                      <strong>{job.pay.toFixed(2)} {token.symbol}</strong>
                      <span>{job.days} {job.days === 1 ? "day" : "days"}</span>
                      <span>{job.clientTag ? `@${job.clientTag}` : "Client"}</span>
                      <span className="board-open">View job <ArrowRight size={13} aria-hidden /></span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
