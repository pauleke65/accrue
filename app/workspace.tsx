"use client";
import {useWorkspace} from "./use-workspace";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Dashboard } from "./ui/dashboard";
import { Earnings, ActivityPage, Connections, Profile } from "./ui/workspace-pages";
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
  UserCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Agreement, Action, Draft, Role } from "@/lib/domain";
import { available, total } from "@/lib/domain";
import Builder, { exampleDraft } from "./ui/builder";
import Detail, { Timeline } from "./ui/detail";
import ActionDialog, { type Intent } from "./ui/action-dialog";
import { Choice, money, Status, date } from "./ui/shared";
type Page = "agreements" | "earnings" | "activity" | "integrations";
const navigation = [
  { id: "agreements", label: "Agreements", icon: FolderOpen },
  { id: "earnings", label: "Earnings", icon: Wallet },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "integrations", label: "Connections", icon: Settings2 },
] as const;
export default function Accrue() {
const {agreements,page,selected,setSelected,loading,error,setError,ready,authenticated,creating,setCreating,busy,intent,setIntent,query,setQuery,filter,setFilter,notice,setNotice,refresh,create,active,act,navigate,visible,reserved,earned,reviews,needsOnboarding,completeOnboarding,profileData}=useWorkspace();
  const { login, logout, user } = usePrivy();

  const userEmail = user?.email?.address || "";
  const userId = user?.id || "";

  // Compute the contextual role for the active agreement
  let role: Role = "payer"; // fallback
  if (active) {
    if (active.payerId === userId) role = "payer";
    else if (active.earner === userEmail) role = "earner";
    else if (active.verifier === userEmail) role = "verifier";
  }

  // 1. Full-screen Loading State
  if (!ready || loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#f5f7fa]">
        <section className="empty-state border-none shadow-none bg-transparent" aria-live="polite">
          <RefreshCw className="spin text-[#145e50]" size={32} />
          <h2 className="mt-4 text-[#465f65]">Opening your workspace…</h2>
        </section>
      </div>
    );
  }

  // 2. Separate Authentication Screen
  if (!authenticated) {
    return (
      <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white">
        {/* Left Column: Brand / Info */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#145e50] p-12 text-white">
          <div>
            <div className="flex items-center gap-3 text-3xl font-extrabold tracking-tight mb-16">
              <ShieldCheck size={36} className="text-[#59b69b]" />
              <span className="tracking-tighter text-4xl">accrue</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight mb-6">
              Guaranteed payments.<br />Verified progress.
            </h1>
            <p className="text-lg text-[#e5f2ec] max-w-md leading-relaxed">
              Accrue is a persistent workspace that keeps every participant's workflow private and secure. Fund the job, agree on completion, and pay only when the work is verified.
            </p>
          </div>
          
          <div className="text-sm text-[#83b7a3]">
            © {new Date().getFullYear()} Accrue Inc. Sandbox Environment.
          </div>
        </div>

        {/* Right Column: Sign in */}
        <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8 lg:p-24 bg-[#f5f7fa]">
          <div className="w-full max-w-sm rounded-2xl bg-white p-10 text-center shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#dce5e7]">
            {/* Mobile logo fallback */}
            <div className="lg:hidden flex justify-center items-center gap-2 text-3xl font-extrabold tracking-tight text-[#145e50] mb-8">
              <ShieldCheck size={32} />
              <span className="tracking-tighter">accrue</span>
            </div>

            <h2 className="mb-2 text-3xl font-bold tracking-tight text-[#172a30]">Welcome back</h2>
            <p className="mb-10 text-[15px] text-[#5d7077]">
              Sign in to your account to continue
            </p>

            <button className="primary w-full justify-center py-3.5 text-base shadow-sm" onClick={login}>
              Sign in with Email <ArrowRight size={18} className="ml-2" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Separate Onboarding Screen
  if (needsOnboarding) {
    return (
      <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white">
        {/* Left Column: Brand / Info */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#145e50] p-12 text-white">
          <div>
            <div className="flex items-center gap-3 text-3xl font-extrabold tracking-tight mb-16">
              <ShieldCheck size={36} className="text-[#59b69b]" />
              <span className="tracking-tighter text-4xl">accrue</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight mb-6">
              You're almost there.
            </h1>
            <p className="text-lg text-[#e5f2ec] max-w-md leading-relaxed">
              Set up your profile to start creating agreements, verifying work, and securely releasing funds.
            </p>
          </div>
          
          <div className="text-sm text-[#83b7a3]">
            © {new Date().getFullYear()} Accrue Inc.
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8 lg:p-24 bg-[#f5f7fa]">
          <div className="w-full max-w-sm rounded-2xl bg-white p-10 text-center shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#dce5e7]">
            {/* Mobile logo fallback */}
            <div className="lg:hidden flex justify-center items-center gap-2 text-3xl font-extrabold tracking-tight text-[#145e50] mb-8">
              <ShieldCheck size={32} />
              <span className="tracking-tighter">accrue</span>
            </div>

            <h2 className="mb-2 text-3xl font-bold tracking-tight text-[#172a30]">Complete profile</h2>
            <p className="mb-10 text-[15px] text-[#5d7077]">
              Before we continue, what should we call you?
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              completeOnboarding(new FormData(e.currentTarget).get('name') as string);
            }}>
              <Input name="name" placeholder="Your full name" required className="mb-6 h-12 text-center text-lg bg-[#f9fbfb]" />
              <button type="submit" className="primary w-full justify-center py-3.5 text-base shadow-sm">
                Continue to Workspace <ArrowRight size={18} className="ml-2" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 4. Fully Authenticated Dashboard
  return (
    <div className="shell">
      <aside className="rail">
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
        <button className="signout" onClick={logout}>
          <LogOut size={15} />
          Sign out
        </button>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <b>{navigation.find((n) => n.id === page)?.label}</b>
          </span>
          <div className="header-actions">
            <span className="avatar tiny">{user?.email?.address?.substring(0, 2).toUpperCase() || "YO"}</span>
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
          
          {active ? (
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
              {page === "earnings" && (
                <Earnings agreements={agreements} setSelected={setSelected} />
              )}
              {page === "activity" && (
                <ActivityPage
                  agreements={agreements}
                  setSelected={setSelected}
                />
              )}
              {page === "profile" && <Profile profileData={profileData} />}
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

