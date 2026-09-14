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
          Three things run side by side, and it matters which is which.{" "}
          <b>Send</b> and <b>Funded jobs</b> both move real {token.symbol} on{" "}
          {network.name}, signed by your passkey against the deployed escrow —
          test money, but genuine transactions that another account can
          independently verify. <b>Sandbox</b> is the same workflow against a
          private ledger in your own workspace: role switching there does not
          grant access to other users, and no sandbox figure has touched a
          network.
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
            status: "Active",
            text: `Funded jobs run through this contract. It is bound at construction to the ${token.symbol} above, so it can never pay in a different token, and it holds the deposit until the named verifier approves the work. Its accounting is covered by tests including conservation fuzzing, but it has had no independent audit and must not hold real money.`,
            link: explorer.address(escrow.address),
            linkText: `Escrow ${shortAddress(escrow.address)}`,
          },
          {
            name: "Funded jobs",
            status: "Active",
            text: `Agreements under "Funded jobs" hold real ${token.symbol} in the contract. Participants are named by tag, each role signs with its own account, and every figure shown is read from the chain. The readable scope and acceptance criteria are held here, because the contract stores only their hashes — the app checks that the text still hashes to what the contract enforces.`,
          },
          {
            name: "Sandbox agreements",
            status: "Simulated",
            text: "The separate sandbox keeps the older simulation: drafting, acceptance, funding, evidence, approval, withdrawal and refunds against a private ledger in D1, with real private evidence files but no real money. It is useful for walking the workflow without spending anything.",
          },
          {
            name: "Gas sponsorship",
            status: "Active",
            text: `A new account holds no MON, so the sponsor pays its first network fees and claims its test ${token.symbol} for it. The sponsor is deliberately narrow: one function on one known faucet, or a small fixed amount of test MON, to the address the signed-in person asked for. It never relays an arbitrary transaction. On a real network this would need a budget, quotas and monitoring before it could be trusted.`,
          },
          {
            name: "Envio HyperSync & HyperRPC",
            status: "Active",
            text: `The plain RPC caps log queries at a hundred blocks — under two minutes of chain — so an account's past payments cannot be recovered from it at all. HyperSync answers the same question over the whole chain and is what the payment list is built on, which is why it covers payments made anywhere rather than only the ones sent from here. HyperRPC serves the same purpose for range reads: a million-block query it answers happily is one the public endpoint refuses outright.`,
          },
          {
            name: "Agora public API",
            status: "Active",
            text: `Supply figures come from Agora's own public API, which needs no key: ${token.symbol} is a real stablecoin with real reserves, and Monad carries the second-largest supply of it after Ethereum. Cash-out to a bank runs through the same API's routes, which needs an organisation key and a verified bank account — built, and reported as unconfigured rather than pretended.`,
            link: "https://docs.agora.finance/api",
            linkText: "Agora API documentation",
          },
          {
            name: "Payment tags",
            status: "Active",
            text: "A tag resolves to an account address so nobody has to read hex to pay someone. Claiming one requires signing the claim with the account it points at. The directory itself lives in this application's database, not on chain: if the app went away the tag would stop resolving, though the account behind it would keep working.",
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
