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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Agreement, Draft } from "@/lib/domain";
import { available, total } from "@/lib/domain";
import { money, Status } from "./shared";
import { exampleDraft } from "./builder";
import { Timeline } from "./detail";
import { token, network, explorer, shortAddress, escrow } from "@/lib/chain";
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
            What is live, what is simulated, and what is not built yet.
          </p>
        </div>
      </div>
      <div className="notice">
        <ShieldCheck />
        <p>
          Two things run side by side. <b>Send</b> moves real {token.symbol} on{" "}
          {network.name}, signed by your passkey — test money, but genuine
          transactions. <b>Agreements</b> are a simulation inside your own
          workspace: role switching does not grant access to other users and no
          agreement figure has touched a network.
        </p>
      </div>
      <div className="connection-grid">
        {[
          {
            name: "Passkey accounts · Mera",
            status: "Active",
            text: "One passkey is the whole account layer. No seed phrase, no extension, and no custody backend: the key is derived from the passkey itself, so the same account reopens on any device holding it. A signing session lasts 15 minutes, then the key is discarded.",
          },
          {
            name: `${token.symbol} · Agora`,
            status: "Active",
            text: `Direct transfers are live on ${network.name} and settle in about a second. Balances on the Send screen are read from the chain, never simulated.`,
            link: explorer.address(token.address),
            linkText: `Token ${shortAddress(token.address)} · ${token.decimals} decimals`,
          },
          {
            name: "Test funds",
            status: "Active",
            text: `Agora's faucet pays 10,000 ${token.symbol} a call, once a minute. Network fees are paid in MON, which comes from the Monad faucet — an account with no MON cannot send yet.`,
            link: network.gasFaucet,
            linkText: "Monad gas faucet",
          },
          {
            name: `Network · ${network.name}`,
            status: "Active",
            text: `Chain ${network.chainId}. Reads fall back across three public endpoints rather than depending on one. This is a test network: balances here are not money.`,
            link: network.explorer,
            linkText: "Block explorer",
          },
          {
            name: "Milestone escrow contract",
            status: "Deployed",
            text: `Live on ${network.name}, bound at construction to the ${token.symbol} above so it can never pay in a different token. Its accounting is covered by tests including conservation fuzzing, but it has had no independent audit and must not hold real money. The milestone agreements below do not use it yet.`,
            link: explorer.address(escrow.address),
            linkText: `Escrow ${shortAddress(escrow.address)}`,
          },
          {
            name: "Milestone agreements",
            status: "Simulated",
            text: "Drafting, acceptance, funding, evidence, approval, withdrawal and refunds run against a private sandbox ledger in D1. Evidence files are real and private; the money is not.",
          },
          {
            name: "Gas sponsorship",
            status: "Activation required",
            text: `A first-time worker or verifier still needs MON before they can transact. ${token.symbol} supports ERC-3009 gasless transfers, which is the intended route: the user signs and a relayer pays. Not built yet.`,
          },
          {
            name: "Envio event indexing",
            status: "Not connected",
            text: "The activity record is read from the sandbox ledger and from direct chain queries. No indexer is running, and the timeline should not be described as one.",
          },
          {
            name: "Bank payouts",
            status: "Outside this release",
            text: `Withdrawals move ${token.symbol}, not naira. Nothing here reaches a bank account, and no local-currency cash-out is implied.`,
          },
        ].map((c) => (
          <section className="panel" key={c.name}>
            <Status value={c.status} />
            <h2>{c.name}</h2>
            <p className="muted">{c.text}</p>
            {c.link && (
              <a
                className="file-link"
                href={c.link}
                target="_blank"
                rel="noreferrer noopener"
              >
                {c.linkText}
                <ArrowUpRight size={14} />
              </a>
            )}
          </section>
        ))}
      </div>
      <section className="panel">
        <h3>Before handling real money</h3>
        <p className="muted">
          Independent contract review, participant invitations bound to real
          accounts, gas sponsorship, monitoring, real-device testing and a
          completed on-network rehearsal all remain outstanding. Test-network
          success is not evidence of production readiness, and the escrow&apos;s
          guarantees cover its own rules only — not token issuer controls, a
          compromised device, or anything outside this contract.
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
