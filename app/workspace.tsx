"use client";
import { useWorkspace } from "./use-workspace";
import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./ui/dashboard";
import { Earnings, ActivityPage, Connections } from "./ui/workspace-pages";
import {
  ArrowUpRight,
  Plus,
  ShieldCheck,
  FolderOpen,
  Wallet,
  Activity,
  Settings2,
  Search,
  ArrowRight,
  RefreshCw,
  LogOut,
  CheckCircle2,
  SendHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Agreement, Action, Draft, Role } from "@/lib/domain";
import { available, total } from "@/lib/domain";
import Builder, { exampleDraft } from "./ui/builder";
import Detail, { Timeline } from "./ui/detail";
import { Send as SendPage } from "./ui/send";
import { useWallet } from "./wallet-context";
import { Fingerprint } from "lucide-react";
import ActionDialog, { type Intent } from "./ui/action-dialog";
import { Choice, money, Status, date } from "./ui/shared";
type Page = "agreements" | "send" | "earnings" | "activity" | "integrations";
const navigation = [
  { id: "agreements", label: "Agreements", icon: FolderOpen },
  { id: "send", label: "Send", icon: SendHorizontal },
  { id: "earnings", label: "Earnings", icon: Wallet },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "integrations", label: "Connections", icon: Settings2 },
] as const;
export default function Accrue() {
  const wallet = useWallet();
  const {
    agreements,
    page,
    role,
    setRole,
    selected,
    setSelected,
    loading,
    error,
    setError,
    signedOut,
    creating,
    setCreating,
    busy,
    intent,
    setIntent,
    query,
    setQuery,
    filter,
    setFilter,
    notice,
    setNotice,
    refresh,
    create,
    active,
    act,
    navigate,
    visible,
    reserved,
    earned,
    reviews,
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
              {id === "agreements" && <span>{agreements.length}</span>}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <ShieldCheck />
          <p>
            Good work.
            <br />
            Guaranteed payment.
          </p>
          <small>Clear terms. Verified progress.</small>
        </div>
        <a className="signout" href="/signout-with-chatgpt?return_to=/">
          <LogOut size={15} />
          Sign out
        </a>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <b>{navigation.find((n) => n.id === page)?.label}</b>
          </span>
          <div className="header-actions">
            {/* The disclosure has to match the page: the send screen moves
                real testnet tokens, while everything else is simulated. */}
            <span className="badge sandbox">
              {page === "send"
                ? "Monad testnet · Test funds"
                : "Sandbox · No real funds"}
            </span>
            {/* One selector for both worlds: it picks the sandbox view and
                the passkey account that signs for that role. The two must not
                drift apart, or the screen would show one role while another
                signs. */}
            <Choice
              label="Role"
              value={role === "earner" ? "worker" : role}
              onChange={(v) => {
                const next = v as "payer" | "worker" | "verifier";
                wallet.setRole(next);
                setRole((next === "worker" ? "earner" : next) as Role);
                setIntent(null);
              }}
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
              <p>
                Sign in to create a persistent sandbox workspace and explore
                every participant’s workflow.
              </p>
              <a className="primary" href="/signin-with-chatgpt?return_to=/">
                Sign in to Accrue <ArrowRight size={16} />
              </a>
            </section>
          ) : loading ? (
            <section className="empty-state" aria-live="polite">
              <RefreshCw className="spin" />
              <h2>Opening your workspace…</h2>
            </section>
          ) : active ? (
            <Detail
              agreement={active}
              role={role}
              onBack={() => setSelected(null)}
              onIntent={setIntent}
            />
          ) : (
            <>
              {page === "agreements" && (
                <Dashboard
                  agreements={agreements}
                  reserved={reserved}
                  earned={earned}
                  reviews={reviews}
                  filter={filter}
                  setFilter={setFilter}
                  query={query}
                  setQuery={setQuery}
                  visible={visible}
                  busy={busy}
                  create={create}
                  setError={setError}
                  setCreating={setCreating}
                  setSelected={setSelected}
                />
              )}
              {page === "send" && <SendPage />}
              {page === "earnings" && (
                <Earnings agreements={agreements} setSelected={setSelected} />
              )}
              {page === "activity" && (
                <ActivityPage
                  agreements={agreements}
                  setSelected={setSelected}
                />
              )}
              {page === "integrations" && <Connections />}
            </>
          )}
        </div>
      </main>
      <Builder
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (d) => {
          await create(d);
        }}
        busy={busy}
      />
      {active && intent && (
        <ActionDialog
          key={`${active.id}-${intent.type}-${intent.milestone}-${role}`}
          agreement={active}
          role={role}
          intent={intent}
          onClose={() => setIntent(null)}
          onAction={act}
        />
      )}
    </div>
  );
}
