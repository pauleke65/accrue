"use client";
import { useWorkspace } from "./use-workspace";
import { useEffect, useState } from "react";
import { Connections } from "./ui/workspace-pages";
import {
  ShieldCheck,
  Wallet,
  Activity,
  Settings2,
  ArrowRight,
  RefreshCw,
  LogOut,
  CheckCircle2,
  SendHorizontal,
} from "lucide-react";
import { Send as SendPage } from "./ui/send";
import { LiveAgreements } from "./ui/live-agreements";
import { LiveEarnings } from "./ui/live-earnings";
import { LiveActivity } from "./ui/live-activity";
import { NetworkSwitch } from "./ui/network-switch";
import { SessionBadge } from "./ui/session-badge";
import { useWallet } from "./wallet-context";
import { Fingerprint } from "lucide-react";
import { Choice } from "./ui/shared";
import { InvitationAcceptModal } from "./ui/invitation-accept-modal";

const navigation = [
  { id: "jobs", label: "Agreements", icon: ShieldCheck },
  { id: "send", label: "Send", icon: SendHorizontal },
  { id: "earnings", label: "Earnings", icon: Wallet },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "integrations", label: "Connections", icon: Settings2 },
] as const;

export default function Accrue() {
  const wallet = useWallet();
  // Lets Earnings and Activity deep-link into a specific funded job, the
  // same way sandbox's own `selected` lets its own pages do.
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
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
    const invite = params.get("invite");
    if (job) {
      setOpenJob(job);
      navigate("jobs");
    } else if (invite) {
      void fetch(`/api/invitations?token=${encodeURIComponent(invite)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.invitation?.agreementId) {
            setOpenJob(data.invitation.agreementId);
            navigate("jobs");
          }
        });
    }
    // Invite links are applied once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="shell">
      <aside className="rail">
        {/* A plain anchor, not next/link: the vinext link shim resolves a
            second React copy through dependency optimization and throws an
            invalid-hook-call at render. The rule is disabled for this line
            rather than silenced project-wide. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">
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
          <span>
            Workspace <span className="slash">/</span>{" "}
            <b>{navigation.find((n) => n.id === page)?.label}</b>
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
            {wallet.wallet ? (
              <button
                className="text-button"
                onClick={wallet.disconnect}
                title={wallet.address ?? undefined}
              >
                {wallet.tags[wallet.role]
                  ? `@${wallet.tags[wallet.role]!.tag}`
                  : "Signed in"}
              </button>
            ) : (
              <>
                <button
                  className="secondary"
                  disabled={!wallet.available || wallet.connecting}
                  onClick={() => void wallet.connect("open")}
                >
                  <Fingerprint size={15} />
                  {wallet.connecting ? "Waiting…" : "Sign in"}
                </button>
                <button
                  className="text-button"
                  disabled={!wallet.available || wallet.connecting}
                  onClick={() => void wallet.connect("create")}
                  style={{ fontSize: "12px" }}
                >
                  New account
                </button>
              </>
            )}
            {!signedOut && (
              <a
                className="icon-button"
                href="/signout-with-chatgpt?return_to=/"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={17} />
              </a>
            )}
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((n) => (
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
            <section className="panel" style={{ maxWidth: "680px", margin: "40px auto 0", textAlign: "center" }}>
              <div className="eyebrow" style={{ marginBottom: "8px" }}>SECURE MILESTONE ESCROW</div>
              <h1 style={{ fontSize: "26px", margin: "0 0 12px", color: "var(--m-ink)" }}>
                Secure milestone payments for your projects<span className="heading-dot">.</span>
              </h1>
              <p className="muted" style={{ fontSize: "15px", maxWidth: "560px", margin: "0 auto 28px", lineHeight: "1.5" }}>
                Accrue holds project funds in a secure digital vault. Money is released step-by-step only after work is verified and approved.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px", textAlign: "left" }}>
                <div style={{ background: "var(--m-surface)", border: "1px solid var(--m-hairline)", padding: "16px" }}>
                  <div className="mono-label" style={{ color: "var(--m-purple-bright)", marginBottom: "6px" }}>01. SET STEPS</div>
                  <strong style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}>Define Milestones</strong>
                  <span className="muted" style={{ fontSize: "12px", lineHeight: "1.4", display: "block" }}>
                    Payer sets job milestones and payment amounts.
                  </span>
                </div>
                <div style={{ background: "var(--m-surface)", border: "1px solid var(--m-hairline)", padding: "16px" }}>
                  <div className="mono-label" style={{ color: "var(--m-purple-bright)", marginBottom: "6px" }}>02. LOCK FUNDS</div>
                  <strong style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}>Deposit to Vault</strong>
                  <span className="muted" style={{ fontSize: "12px", lineHeight: "1.4", display: "block" }}>
                    Money is locked in escrow—guaranteed, but untouchable.
                  </span>
                </div>
                <div style={{ background: "var(--m-surface)", border: "1px solid var(--m-hairline)", padding: "16px" }}>
                  <div className="mono-label" style={{ color: "var(--m-positive)", marginBottom: "6px" }}>03. VERIFY & PAY</div>
                  <strong style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}>Approve Release</strong>
                  <span className="muted" style={{ fontSize: "12px", lineHeight: "1.4", display: "block" }}>
                    Worker submits proof, Verifier approves, funds release.
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  className="primary"
                  disabled={!wallet.available || wallet.connecting}
                  onClick={() => void wallet.connect("create")}
                  style={{ padding: "12px 24px" }}
                >
                  <Fingerprint size={16} />
                  {wallet.connecting ? "Creating…" : "Create account"}
                </button>
                <button
                  className="secondary"
                  disabled={!wallet.available || wallet.connecting}
                  onClick={() => void wallet.connect("open")}
                  style={{ padding: "12px 24px" }}
                >
                  <ArrowRight size={16} />
                  {wallet.connecting ? "Waiting…" : "Sign in with Passkey"}
                </button>
              </div>
              <p className="muted" style={{ fontSize: "12px", marginTop: "12px" }}>
                First time? Create an account. Your passkey is stored on your device — no passwords, no seed phrases.
              </p>
            </section>
          ) : loading ? (
            <section className="empty-state" aria-live="polite">
              <RefreshCw className="spin" />
              <h2>Opening your workspace…</h2>
            </section>
          ) : (
            <>
              {page === "jobs" && (
                <LiveAgreements openId={openJob} onOpenChange={setOpenJob} />
              )}
              {page === "send" && <SendPage />}
              {page === "earnings" && (
                <LiveEarnings
                  onOpen={(id) => {
                    navigate("jobs");
                    setOpenJob(id);
                  }}
                />
              )}
              {page === "activity" && (
                <LiveActivity
                  onOpen={(id) => {
                    navigate("jobs");
                    setOpenJob(id);
                  }}
                />
              )}
              {page === "integrations" && <Connections />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
