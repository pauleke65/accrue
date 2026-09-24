"use client";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Status } from "./shared";
import { token, network, explorer, shortAddress, escrow } from "@/lib/chain";
import { useWallet } from "../wallet-context";
export function Connections() {
  const w = useWallet();
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
          <b>Send</b> and <b>Agreements</b> move real {token.symbol} on{" "}
          {network.name}, signed by your passkey. Each passkey is one person.
          Name someone by their @tag and they see the job on their own phone
          after they sign in. The Role switcher is a one-device walkthrough,
          off unless you turn it on below.
        </p>
      </div>
      <section className="panel">
        <Status value={w.demoRoles ? "Demo" : "Product"} />
        <h2>One device, three roles</h2>
        <p className="muted">
          Off: your passkey is one account. You pay, work, or verify based on
          which jobs name that account. On: this passkey derives three
          addresses so you can demonstrate every side without a second phone.
        </p>
        <button
          className="secondary"
          onClick={() => w.setDemoRoles(!w.demoRoles)}
        >
          {w.demoRoles ? "Turn demo roles off" : "Turn demo roles on"}
        </button>
      </section>
      <div className="connection-grid">
        {[
          {
            name: "Passkey accounts · Mera",
            status: "Active",
            text: "One passkey is one person. No seed phrase, no extension, no custody backend. The same passkey reopens the same account on any device that holds it. A signing session lasts 15 minutes, then the key is discarded.",
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
            name: "Agreements",
            status: "Active",
            text: `Jobs hold real ${token.symbol} in the contract. People are named by @tag. Each person signs with their own passkey. Share the job link so the other phone can open it and accept.`,
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
