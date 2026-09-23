"use client";
import { useWorkspace } from "./use-workspace";
import { useState } from "react";
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
            <Choice
              label="Role"
              value={wallet.role}
              onChange={(v) => wallet.setRole(v as "payer" | "worker" | "verifier")}
              items={[
                { value: "payer", label: "Payer view" },
                { value: "worker", label: "Worker view" },
                { value: "verifier", label: "Verifier view" },
              ]}
            />
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
              <button
                className="secondary"
                disabled={!wallet.available || wallet.connecting}
                onClick={() => void wallet.connect("open")}
              >
                <Fingerprint size={15} />
                {wallet.connecting ? "Waiting…" : "Sign in"}
              </button>
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
          {signedOut ? (
            <section className="empty-state">
              <ShieldCheck size={36} />
              <h1>Your agreements, kept private.</h1>
              <p>Sign in to fund jobs, send money, and track your earnings.</p>
              <a className="primary" href="/signin-with-chatgpt?return_to=/">
                Sign in to Accrue <ArrowRight size={16} />
              </a>
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
