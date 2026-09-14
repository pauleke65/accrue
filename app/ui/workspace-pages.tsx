"use client";
import {
  ArrowUpRight,
  Plus,
  ShieldCheck,
  FolderOpen,
  Wallet,
  Activity,
  Search,
  ArrowRight,
  UserCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Agreement, Draft } from "@/lib/domain";
import { available, total } from "@/lib/domain";
import { money, Status } from "./shared";
import { exampleDraft } from "./builder";
import { Timeline } from "./detail";
export function Earnings({
  agreements,
  setSelected,
}: {
  agreements: Agreement[];
  setSelected: (s: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORK, REWARDED</p>
          <h1>Earnings & withdrawals</h1>
          <p className="muted">
            Earned is not the same as withdrawn. Your allocation stays yours.
          </p>
        </div>
      </div>
      <div className="metrics">
        {(["earner", "verifier"] as const).map((r, i) => (
          <section key={r} className={`metric ${i === 0 ? "featured" : ""}`}>
            <span>
              {r === "earner" ? "Worker" : "Verifier"} · available to withdraw
            </span>
            <strong>
              {money(agreements.reduce((s, a) => s + available(a, r), 0))}
            </strong>
            <small>
              Withdrawn{" "}
              {money(agreements.reduce((s, a) => s + a.withdrawn[r], 0))}
            </small>
          </section>
        ))}
      </div>
      <div className="notice">
        <ShieldCheck />
        <p>
          Sandbox only. No stablecoin or bank payout is being processed. Select
          a beneficiary view, then open an agreement to withdraw that role’s
          available balance.
        </p>
      </div>
      {agreements.length ? (
        agreements.map((a) => (
          <div className="earning-row" key={a.id}>
            <div>
              <h3>{a.title}</h3>
              <p className="muted">
                Worker {money(available(a, "earner"))} · Verifier{" "}
                {money(available(a, "verifier"))}
              </p>
            </div>
            <button className="secondary" onClick={() => setSelected(a.id)}>
              Open agreement
              <ArrowUpRight size={16} />
            </button>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Wallet />
          <h2>Your earned allocations will appear here.</h2>
        </div>
      )}
    </>
  );
}
export function ActivityPage({
  agreements,
  setSelected,
}: {
  agreements: Agreement[];
  setSelected: (s: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A SHARED RECORD</p>
          <h1>Activity & attestations</h1>
          <p className="muted">
            Every decision, allocation, and correction in one place.
          </p>
        </div>
      </div>
      <div className="notice">
        <p>
          {agreements.reduce(
            (s, a) =>
              s + a.timeline.filter((t) => t.action === "approve").length,
            0,
          )}{" "}
          attestations ·{" "}
          {agreements.reduce(
            (s, a) =>
              s + a.timeline.filter((t) => t.action === "correct").length,
            0,
          )}{" "}
          corrections. These are sandbox activity counts, not a trust score or
          proof of professional credentials.
        </p>
      </div>
      {agreements.map((a) => (
        <section className="panel" key={a.id}>
          <div className="section-title">
            <h2>{a.title}</h2>
            <button className="text-button" onClick={() => setSelected(a.id)}>
              Open <ArrowUpRight size={15} />
            </button>
          </div>
          <Timeline agreement={a} />
        </section>
      ))}
      {!agreements.length && (
        <div className="empty-state">
          <Activity />
          <h2>No activity yet.</h2>
        </div>
      )}
    </>
  );
}
export function Connections() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BUILT FOR TRANSPARENCY</p>
          <h1>Connections & environment</h1>
          <p className="muted">
            What is working, what is simulated, and what needs activation.
          </p>
        </div>
      </div>
      <div className="notice">
        <ShieldCheck />
        <p>
          This is a private, persistent product sandbox. Role switching
          simulates participants inside your own workspace. It does not grant
          access to other users or authorize real transactions.
        </p>
      </div>
      <div className="connection-grid">
        {[
          {
            name: "Private workspace",
            status: "Active",
            text: "Authenticated workspace data in D1, with private evidence files in R2. Sandbox activity is saved on the server.",
          },
          {
            name: "Monad settlement",
            status: "Not connected",
            text: "Contract source accompanies this app. No deployed contract, network receipt, or real funding is claimed.",
          },
          {
            name: "Agora · AUSD",
            status: "Activation required",
            text: "Token address and permitted network must be verified before funding is enabled. Current balances are simulated USD units.",
          },
          {
            name: "Embedded wallets",
            status: "Activation required",
            text: "Privy or Dynamic credentials, participant-bound accounts, recovery, and gas sponsorship are required for live onboarding.",
          },
          {
            name: "Envio event indexing",
            status: "Not connected",
            text: "Current activity comes from the sandbox ledger. A live deployment requires event indexing and RPC reconciliation.",
          },
          {
            name: "Bank payouts",
            status: "Outside this release",
            text: "Withdrawals simulate a beneficiary account transfer. They do not represent local-currency cash-out.",
          },
        ].map((c) => (
          <section className="panel" key={c.name}>
            <Status value={c.status} />
            <h2>{c.name}</h2>
            <p className="muted">{c.text}</p>
          </section>
        ))}
      </div>
      <section className="panel">
        <h3>Before handling real funds</h3>
        <p className="muted">
          Independent contract review, production identity and invitation flows,
          token integration, gas sponsorship, monitoring, real-device testing,
          and a completed on-network rehearsal are required. This prototype is
          not financial production infrastructure.
        </p>
        <a
          className="text-button"
          href="https://hackathon.monad.xyz/"
          target="_blank"
          rel="noreferrer"
        >
          Track 2 · Consumer Products & Payments <ArrowUpRight size={16} />
        </a>
      </section>
    </>
  );
}

export function Profile({
  profileData,
}: {
  profileData: { name: string | null; email: string; walletAddress: string } | null;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Profile</h1>
          <p className="muted">Your identity and connected wallet on Accrue.</p>
        </div>
      </div>
      {profileData ? (
        <section className="panel" style={{ maxWidth: "600px", padding: "2rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <p className="muted" style={{ marginBottom: "0.5rem", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Full Name</p>
              <p style={{ fontWeight: 600, fontSize: "18px" }}>{profileData.name || "Not provided"}</p>
            </div>
            <hr style={{ border: "0", borderTop: "1px solid #dce5e7" }} />
            <div>
              <p className="muted" style={{ marginBottom: "0.5rem", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email Address</p>
              <p style={{ fontWeight: 600, fontSize: "18px" }}>{profileData.email}</p>
            </div>
            <hr style={{ border: "0", borderTop: "1px solid #dce5e7" }} />
            <div>
              <p className="muted" style={{ marginBottom: "0.5rem", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Smart Wallet Address</p>
              <p style={{ fontWeight: 600, fontSize: "16px", fontFamily: "monospace", wordBreak: "break-all", background: "#f5f7fa", padding: "12px", borderRadius: "8px", border: "1px solid #dce5e7" }}>
                {profileData.walletAddress}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <UserCircle size={48} className="text-[#145e50]" />
          <h2>Loading profile data...</h2>
        </div>
      )}
    </>
  );
}
