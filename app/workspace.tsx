"use client";
import { useWorkspace } from "./use-workspace";
import { useEffect, useState } from "react";
import { Connections } from "./ui/workspace-pages";
import {
  ShieldCheck,
  Wallet,
  Activity,
  Settings2,
  RefreshCw,
  LogOut,
  CheckCircle2,
  SendHorizontal,
  House,
  BriefcaseBusiness,
  Layers,
  ScanSearch,
} from "lucide-react";
import { Send as SendPage } from "./ui/send";
import { LiveAgreements } from "./ui/live-agreements";
import { DigitalWork } from "./ui/digital-work";
import { LiveEarnings } from "./ui/live-earnings";
import { LiveActivity } from "./ui/live-activity";
import { NetworkSwitch } from "./ui/network-switch";
import { SessionBadge } from "./ui/session-badge";
import { useWallet } from "./wallet-context";
import { Home, SignInCard, type HomeIntent } from "./ui/home";
import type { JobKind } from "@/lib/next-actions";
import { Choice } from "./ui/shared";
import { InvitationAcceptModal } from "./ui/invitation-accept-modal";
import { OfferModal } from "./ui/offer-modal";
import type { TakenOffer } from "./ui/home";
import type { DigitalDraft } from "./use-digital-work";
import type { Draft } from "./use-live-agreements";

// Ordered by what people come to do: see what needs them, work on jobs,
// then money. Connections is status, not a destination, so it sits apart.
const navigation = [
  { id: "home", label: "Home", icon: House },
  { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "earnings", label: "Earnings", icon: Wallet },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "send", label: "Send", icon: SendHorizontal },
] as const;

const pageLabel: Record<string, string> = { integrations: "Connections" };

export default function Accrue() {
  const wallet = useWallet();
  // Lets Earnings and Activity deep-link into a specific funded job, the
  // same way sandbox's own `selected` lets its own pages do.
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  // Which escrow the Jobs page shows, and whether Home asked it to open the
  // builder or one job. The nonce remounts the page so that request applies.
  const [jobKind, setJobKind] = useState<JobKind>("proof");
  const [jobIntent, setJobIntent] = useState<{ create: boolean; openId: string | null; offer: TakenOffer | null; draft: Record<string, unknown> | null; nonce: number }>({ create: false, openId: null, offer: null, draft: null, nonce: 0 });
  // A hiring link someone opened, shown over whatever page they land on.
  const [offerToken, setOfferToken] = useState<string | null>(null);

  /** Opens the Jobs page on one job, or on a job type's builder. */
  const goToJobs = (kind: JobKind, target: { openId?: string; create?: boolean; offer?: TakenOffer; draft?: Record<string, unknown> } = {}) => {
    setJobKind(kind);
    if (kind === "milestone") setOpenJob(target.openId ?? null);
    setJobIntent((prev) => ({ create: !!target.create, openId: target.openId ?? null, offer: target.offer ?? null, draft: target.draft ?? null, nonce: prev.nonce + 1 }));
    navigate("jobs");
  };
  const {
    page,
    loading,
    error,
    signedOut,
    notice,
    setNotice,
    refresh,
    navigate,
  } = useWorkspace();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const job = params.get("job");
    const proof = params.get("proof");
    const invite = params.get("invite");
    const offer = params.get("offer");
    queueMicrotask(() => {
      if (job) {
        setOpenJob(job);
        setJobKind("milestone");
        navigate("jobs");
      } else if (proof) {
        goToJobs("proof", { openId: proof });
      } else if (invite) {
        setInviteToken(invite);
      } else if (offer) {
        setOfferToken(offer);
      }
    });
    // Invite links are applied once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="shell">
      <aside className="rail">
        {/* A plain anchor, not next/link: the vinext link shim resolves a
            second React copy through dependency optimization and throws an
            invalid-hook-call at render. */}
        <a className="brand" href="/app">
          a<span>accrue</span>
        </a>
        <p className="eyebrow">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-item selected" : "nav-item"}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <SessionBadge />
        <div className="rail-links">
          <button className={page === "integrations" ? "rail-link selected" : "rail-link"} onClick={() => navigate("integrations")}>
            <Settings2 size={15} aria-hidden /> Connections
          </button>
          {!signedOut && (
            <a className="rail-link" href="/signout-with-chatgpt?return_to=/">
              <LogOut size={15} aria-hidden /> Leave workspace
            </a>
          )}
        </div>
        <div className="rail-bottom">
          <ShieldCheck />
          <p>
            Good work.
            <br />
            Guaranteed payment.
          </p>
          <small>Clear terms. Verified progress.</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <a className="brand topbar-brand" href="/app">a<span>accrue</span></a>
          <span>
            Workspace <span className="slash">/</span>{" "}
            <b>{navigation.find((n) => n.id === page)?.label ?? pageLabel[page]}</b>
          </span>
          <div className="header-actions">
            {/* The disclosure has to match the page: the send screen moves
                real testnet tokens, while everything else reads the chain
                without moving anything. */}
            {page === "send" || page === "jobs" ? (
              <NetworkSwitch />
            ) : null}
            {wallet.demoRoles && (
              <Choice
                label="Role"
                value={wallet.role}
                onChange={(v) =>
                  wallet.setRole(v as "payer" | "worker" | "verifier")
                }
                items={[
                  { value: "payer", label: "Payer view" },
                  { value: "worker", label: "Worker view" },
                  { value: "verifier", label: "Verifier view" },
                ]}
              />
            )}
            {/* Signed out, the page body carries the sign-in card; repeating
                the buttons up here only split attention. */}
            {wallet.wallet && (
              <>
                <span className="identity-chip" title={wallet.address ?? undefined}>
                  {wallet.tags[wallet.role] ? `@${wallet.tags[wallet.role]!.tag}` : "Signed in"}
                </span>
                <button className="text-button" onClick={wallet.disconnect}>Sign out</button>
              </>
            )}
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {/* The rail is hidden here, so Connections joins the strip. */}
          {[...navigation, { id: "integrations", label: "Connections" } as const].map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={page === n.id ? "selected" : ""}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="content">
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button className="text-button" onClick={() => void refresh()}>
                Retry <RefreshCw size={14} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success-banner" role="status">
              <CheckCircle2 size={17} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {signedOut && !wallet.wallet ? (
            <SignInCard />
          ) : loading ? (
            <section className="empty-state" aria-live="polite">
              <RefreshCw className="spin" />
              <h2>Opening your workspace…</h2>
            </section>
          ) : (
            <>
              {page === "home" && (
                <Home
                  onIntent={(intent: HomeIntent) =>
                    intent.type === "open"
                      ? goToJobs(intent.kind, { openId: intent.id })
                      : goToJobs(intent.kind, { create: true, offer: intent.offer, draft: intent.draft })}
                />
              )}
              {page === "jobs" && (
                <>
                  {wallet.wallet && (
                    <div className="job-kind-switch" role="tablist" aria-label="Job type">
                      {([
                        { id: "proof", label: "Proof-checked", icon: ScanSearch },
                        { id: "milestone", label: "Milestone", icon: Layers },
                      ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          role="tab"
                          aria-selected={jobKind === id}
                          onClick={() => {
                            setJobKind(id);
                            setJobIntent((prev) => ({ create: false, openId: null, offer: null, draft: null, nonce: prev.nonce + 1 }));
                            if (id === "milestone") setOpenJob(null);
                          }}
                        >
                          <Icon size={15} aria-hidden /> {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {jobKind === "proof" ? (
                    <DigitalWork
                      key={`proof-${jobIntent.nonce}`}
                      initialCreating={jobIntent.create}
                      initialSelectedId={jobIntent.openId}
                      offer={jobIntent.offer?.kind === "proof" ? { token: jobIntent.offer.token, takenBy: jobIntent.offer.takenBy, draft: jobIntent.offer.draft as unknown as DigitalDraft } : null}
                    />
                  ) : (
                    <LiveAgreements
                      key={`milestone-${jobIntent.nonce}`}
                      openId={openJob}
                      onOpenChange={setOpenJob}
                      initialCreating={jobIntent.create}
                      seedDraft={(jobIntent.draft as unknown as Draft) ?? undefined}
                      offer={jobIntent.offer?.kind === "milestone" ? { token: jobIntent.offer.token, takenBy: jobIntent.offer.takenBy, draft: jobIntent.offer.draft as unknown as Draft } : null}
                    />
                  )}
                </>
              )}
              {page === "send" && <SendPage />}
              {page === "earnings" && (
                <LiveEarnings onOpen={(id, kind) => goToJobs(kind, { openId: id })} />
              )}
              {page === "activity" && (
                <LiveActivity onOpen={(id, source) => goToJobs(source, { openId: id })} />
              )}
              {page === "integrations" && <Connections />}
            </>
          )}
        </div>
      </main>
      {offerToken && (
        <OfferModal
          offerToken={offerToken}
          onClose={() => {
            setOfferToken(null);
            // Drop ?offer= so a refresh does not reopen it.
            window.history.replaceState(null, "", "/app");
            navigate("home");
          }}
        />
      )}
      {inviteToken && (
        <InvitationAcceptModal
          token={inviteToken}
          onClose={() => setInviteToken(null)}
          onAccepted={(agreementId) => {
            setInviteToken(null);
            setOpenJob(agreementId);
            setJobKind("milestone");
            navigate("jobs");
          }}
        />
      )}
    </div>
  );
}
