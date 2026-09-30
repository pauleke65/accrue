import { ArrowRight, ArrowUpRight, BadgeCheck, Code2, FileText, GitPullRequest, Layers, ScanSearch, ShieldCheck } from "lucide-react";
import { explorer, formatAmount, shortAddress, token } from "@/lib/chain";
import { loadProfile, type ProfileItem } from "@/lib/profile";

// Plain anchors throughout: see the note on next/link in app/workspace.tsx.

const deliverableLabel = { webpage: "Live web page", pull_request: "Merged pull request", api: "Working API" } as const;
const deliverableIcon = { webpage: FileText, pull_request: GitPullRequest, api: Code2 } as const;

function describe(item: ProfileItem): { title: string; icon: typeof FileText } {
  if (item.flow === "proof") {
    const kind = item.deliverable ?? "api";
    return { title: `Proof-checked · ${deliverableLabel[kind]}`, icon: item.deliverable ? deliverableIcon[kind] : ScanSearch };
  }
  const stages = item.stages ? ` · ${item.stages.approved} of ${item.stages.total} ${item.stages.total === 1 ? "stage" : "stages"} approved` : "";
  return { title: `Milestone job${stages}`, icon: Layers };
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Live data on every request: open jobs and on-chain records change constantly.
export const dynamic = "force-dynamic";

export default async function PublicProfile({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const profile = await loadProfile(decodeURIComponent(tag)).catch(() => null);

  return (
    <div className="lp">
      <header className="lp-nav">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">a<span>accrue</span></a>
        <a className="primary lp-nav-cta" href="/app">Open app <ArrowRight size={15} aria-hidden /></a>
      </header>

      <main className="profile">
        {!profile ? (
          <section className="profile-missing">
            <h1>Nobody here yet.</h1>
            <p>No one on Accrue goes by @{decodeURIComponent(tag).replace(/^@/, "")}.</p>
          </section>
        ) : (
          <>
            <section className="profile-head">
              <span className="lp-kicker"><BadgeCheck size={14} aria-hidden /> Verified work record</span>
              <h1>@{profile.tag}</h1>
              <p>
                {profile.displayName}
                {" · "}
                <a href={explorer.address(profile.address)} target="_blank" rel="noreferrer noopener">
                  {shortAddress(profile.address)} <ArrowUpRight size={13} aria-hidden />
                </a>
              </p>
            </section>

            <section className="profile-stats" aria-label="Summary">
              <div><span>Jobs delivered and paid</span><strong>{profile.worker.jobs}</strong></div>
              <div><span>Earned as worker</span><strong>{formatAmount(BigInt(profile.worker.earned))}</strong><small>{token.symbol}</small></div>
              <div><span>Review decisions</span><strong>{profile.reviewer.decisions}</strong></div>
              <div><span>Earned reviewing</span><strong>{formatAmount(BigInt(profile.reviewer.earned))}</strong><small>{token.symbol}</small></div>
            </section>

            <section aria-labelledby="profile-history">
              <h2 id="profile-history" className="profile-section-title">History</h2>
              {profile.items.length === 0 ? (
                <div className="profile-empty">
                  <ShieldCheck size={20} aria-hidden />
                  <p>No verified work yet. Every job @{profile.tag} is paid for, or reviews, will appear here once the contract settles it.</p>
                </div>
              ) : (
                <ol className="profile-items">
                  {profile.items.map((item) => {
                    const { title, icon: Icon } = describe(item);
                    return (
                      <li key={item.key}>
                        <span className="profile-item-icon" aria-hidden><Icon size={17} /></span>
                        <div>
                          <b>{title}</b>
                          <span>{item.role === "worker" ? "Delivered as worker" : "Decided as reviewer"} · {day(item.date)} · job #{item.jobNumber}</span>
                        </div>
                        <strong>{formatAmount(BigInt(item.amount))} {token.symbol}</strong>
                        <a href={item.verifyUrl} target="_blank" rel="noreferrer noopener" aria-label={`Verify job ${item.jobNumber} on the Monad explorer`}>
                          Verify <ArrowUpRight size={13} aria-hidden />
                        </a>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <p className="profile-note">
              Every line is read from the escrow contracts on Monad testnet, not typed in by anyone.
              Job titles and briefs stay private to the people on each job.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
