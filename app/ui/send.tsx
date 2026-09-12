"use client";
import { useState } from "react";
import { ArrowUpRight, Fingerprint, ShieldCheck, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLiveAccount } from "../use-live-account";
import {
  formatAmount,
  shortAddress,
  explorer,
  token,
  network,
} from "@/lib/chain";

/**
 * The live payment surface: a real AUSD transfer on Monad testnet, settled in
 * seconds, behind one passkey. This is deliberately separate from the sandbox
 * agreements — every figure on this screen came from the chain.
 */
export function Send() {
  const live = useLiveAccount();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const minutes = Math.floor(live.remaining / 60000);
  const seconds = Math.floor((live.remaining % 60000) / 1000);
  const lowGas = live.gas !== null && live.gas === 0n;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Send money home</p>
          <h1>Pay anyone, in seconds.</h1>
          <p className="muted">
            One passkey. No seed phrase, no app to install, no wallet to set up.
            Money arrives in seconds and the receipt is public.
          </p>
        </div>
      </div>

      {live.error && (
        <div role="alert" className="error-banner">
          {live.error}
          <button className="text-button" onClick={() => live.setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {!live.available && (
        <div className="notice">
          <ShieldCheck size={17} />
          <div>
            Passkeys need a secure connection. Open this page over HTTPS, or on
            localhost while developing.
          </div>
        </div>
      )}

      {!live.connection ? (
        <section className="panel">
          <h2>Start with a passkey</h2>
          <p className="muted">
            Your account is created from a passkey on this device. Nothing is
            stored on our servers, and the same passkey opens the same account
            anywhere — including a device you have never used before.
          </p>
          <div className="milestone-actions">
            <button
              className="primary"
              disabled={!live.available || live.connecting}
              onClick={() => void run(() => live.connect("create"))}
            >
              <Fingerprint size={16} />
              {live.connecting ? "Waiting…" : "Create an account"}
            </button>
            <button
              className="secondary"
              disabled={!live.available || live.connecting}
              onClick={() => void run(() => live.connect("signin"))}
            >
              I already have one
            </button>
          </div>
          <p className="fine-print">
            {network.name} · test money only, never real funds
          </p>
        </section>
      ) : (
        <>
          <div className="metrics">
            <section className="metric featured">
              <div className="section-title">
                <span>Your balance</span>
                <Wallet size={17} />
              </div>
              <strong>
                {live.balance === null
                  ? "—"
                  : `${formatAmount(live.balance)} ${token.symbol}`}
              </strong>
              <small>
                {shortAddress(live.connection.address)} · signed in for{" "}
                {minutes}:{String(seconds).padStart(2, "0")}
              </small>
            </section>
            <section className="metric">
              <span>Network fee balance</span>
              <strong>
                {live.gas === null
                  ? "—"
                  : `${(Number(live.gas) / 1e18).toFixed(4)} MON`}
              </strong>
              <small>
                {lowGas
                  ? "Needed to send. Top up at faucet.monad.xyz."
                  : "Covers the cost of sending."}
              </small>
            </section>
            <section className="metric">
              <span>Test money</span>
              <strong>10,000</strong>
              <small>
                {token.symbol} a time, once a minute, from Agora&apos;s faucet.
              </small>
            </section>
          </div>

          <section className="panel">
            <div className="section-title left">
              <h2>Send {token.symbol}</h2>
            </div>
            <div className="form-stack">
              <label>
                Recipient account
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                />
              </label>
              <label>
                Amount
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </label>
              <div className="milestone-actions">
                <button
                  className="primary"
                  disabled={busy || !to || !amount}
                  onClick={() => void run(() => live.send(to, amount))}
                >
                  <ArrowUpRight size={16} />
                  {busy ? "Sending…" : `Send ${token.symbol}`}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void run(live.drip)}
                >
                  Get test {token.symbol}
                </button>
                <button className="text-button" onClick={live.forget}>
                  Sign out
                </button>
              </div>
              <p className="fine-print">
                Transfers are final once confirmed. Check the recipient account
                before sending.
              </p>
            </div>
          </section>
        </>
      )}

      {live.transaction.status !== "idle" && <TransactionCard live={live} />}
    </>
  );
}

function TransactionCard({
  live,
}: {
  live: ReturnType<typeof useLiveAccount>;
}) {
  const { transaction } = live;
  const copy: Record<string, { title: string; detail: string }> = {
    "awaiting-signature": {
      title: "Confirming with your passkey",
      detail: "Approve the prompt on your device.",
    },
    submitted: {
      title: "Sent to the network",
      detail: "Waiting for the network to confirm.",
    },
    confirmed: {
      title: "Payment confirmed",
      detail: "The money has arrived and the receipt is public.",
    },
    failed: {
      title: "Payment did not go through",
      detail: transaction.error ?? "Nothing was sent.",
    },
    unknown: {
      title: "Outcome not yet known",
      detail:
        transaction.error ??
        "This was sent but has not been confirmed. Check before sending again.",
    },
  };
  const current = copy[transaction.status];
  if (!current) return null;
  return (
    <section className="panel">
      <div className="section-title left">
        <h3>{current.title}</h3>
      </div>
      <p className="muted">{current.detail}</p>
      {transaction.hash && (
        <p className="fine-print">
          <a
            className="file-link"
            href={explorer.tx(transaction.hash)}
            target="_blank"
            rel="noreferrer noopener"
          >
            View the receipt
            <ArrowUpRight size={13} />
          </a>
        </p>
      )}
      <div className="milestone-actions">
        {transaction.status === "unknown" && (
          <button className="secondary" onClick={() => void live.check()}>
            Check again
          </button>
        )}
        {["confirmed", "failed"].includes(transaction.status) && (
          <button className="text-button" onClick={live.clearTransaction}>
            Done
          </button>
        )}
      </div>
    </section>
  );
}

export default Send;
