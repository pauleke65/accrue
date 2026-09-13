"use client";
import { useState } from "react";
import { ArrowUpRight, AtSign, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWallet } from "../wallet-context";
import { sendAusd, requestFaucetDrip, reconcile } from "@/lib/ausd";
import {
  formatAmount,
  parseAmount,
  shortAddress,
  explorer,
  token,
  network,
  type TransactionState,
} from "@/lib/chain";

/**
 * Sending money to a person rather than to an address.
 *
 * A tag is a directory entry, not a different kind of payment: it resolves to
 * an account address and the transfer that follows is an ordinary on-chain
 * transfer. The recipient does not have to hold a tag — an address still
 * works — but nobody should have to read hex to pay someone.
 */
export function Send() {
  const w = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [transaction, setTransaction] = useState<TransactionState>({
    status: "idle",
  });
  const [resolved, setResolved] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");

  const balance = w.balances[w.role];
  const gas = w.gas[w.role];
  const noGas = gas !== null && gas === 0n;

  async function destination(): Promise<`0x${string}`> {
    const value = to.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(value)) return value as `0x${string}`;
    const found = await w.resolveTag(value);
    if (!found)
      throw new Error(
        `Nobody here goes by ${value.startsWith("@") ? value : `@${value}`} yet.`,
      );
    setResolved(`${found.displayName} · ${shortAddress(found.address)}`);
    return found.address;
  }

  async function send() {
    if (!w.account) return;
    setBusy(true);
    setLocalError("");
    setResolved(null);
    try {
      const target = await destination();
      const value = parseAmount(amount);
      const state = await sendAusd({
        account: w.account,
        to: target,
        amount: value,
        report: setTransaction,
      });
      if (state.status !== "failed") {
        await w.refresh();
        setAmount("");
      }
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function drip() {
    if (!w.account) return;
    setBusy(true);
    try {
      const state = await requestFaucetDrip({
        account: w.account,
        report: setTransaction,
      });
      if (state.status !== "failed") await w.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!w.wallet)
    return (
      <div className="empty-state">
        <Wallet />
        <h2>Sign in to send money.</h2>
        <p>
          One passkey opens your account. There is nothing to install and no
          seed phrase to keep.
        </p>
      </div>
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Send money home</p>
          <h1>Pay anyone, in seconds.</h1>
          <p className="muted">
            Send to a tag like @bola, or to an account address. Money arrives in
            seconds and the receipt is public.
          </p>
        </div>
      </div>

      {(localError || w.error) && (
        <div role="alert" className="error-banner">
          {localError || w.error}
          <button
            className="text-button"
            onClick={() => {
              setLocalError("");
              w.setError("");
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="metrics">
        <section className="metric featured">
          <div className="section-title">
            <span>Balance · {w.role}</span>
            <Wallet size={17} />
          </div>
          <strong>
            {balance === null
              ? "—"
              : `${formatAmount(balance)} ${token.symbol}`}
          </strong>
          <small>
            {w.tags[w.role]
              ? `@${w.tags[w.role]!.tag}`
              : shortAddress(w.address ?? "0x")}
          </small>
        </section>
        <section className="metric">
          <span>Network fee balance</span>
          <strong>
            {gas === null ? "—" : `${(Number(gas) / 1e18).toFixed(3)} MON`}
          </strong>
          <small>
            {noGas
              ? "Needed before this account can send."
              : "Covers the cost of sending."}
          </small>
        </section>
        <section className="metric">
          <span>Test money</span>
          <strong>10,000</strong>
          <small>{token.symbol} a call, once a minute.</small>
        </section>
      </div>

      <section className="panel">
        <div className="section-title left">
          <h2>Send {token.symbol}</h2>
        </div>
        <div className="form-stack">
          <label>
            To
            <Input
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setResolved(null);
              }}
              placeholder="@bola, or an account address"
              spellCheck={false}
            />
          </label>
          {resolved && <p className="fine-print">Sending to {resolved}</p>}
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
              disabled={busy || !to || !amount || noGas}
              onClick={() => void send()}
            >
              <ArrowUpRight size={16} />
              {busy ? "Sending…" : `Send ${token.symbol}`}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void drip()}
            >
              Get test {token.symbol}
            </button>
          </div>
          <p className="fine-print">
            {network.name}. Transfers are final once confirmed — check who you
            are paying before sending.
          </p>
        </div>
      </section>

      {transaction.status !== "idle" && (
        <Receipt
          transaction={transaction}
          onCheck={async () => {
            if (transaction.hash)
              setTransaction(await reconcile(transaction.hash));
            await w.refresh();
          }}
          onDone={() => setTransaction({ status: "idle" })}
        />
      )}
    </>
  );
}

function Receipt({
  transaction,
  onCheck,
  onDone,
}: {
  transaction: TransactionState;
  onCheck: () => Promise<void>;
  onDone: () => void;
}) {
  const copy: Record<string, { title: string; detail: string }> = {
    "awaiting-signature": {
      title: "Confirming",
      detail: "Signing with the account for this role.",
    },
    submitted: {
      title: "Sent",
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
        <a
          className="file-link"
          href={explorer.tx(transaction.hash)}
          target="_blank"
          rel="noreferrer noopener"
        >
          View the receipt <ArrowUpRight size={13} />
        </a>
      )}
      <div className="milestone-actions">
        {transaction.status === "unknown" && (
          <button className="secondary" onClick={() => void onCheck()}>
            Check again
          </button>
        )}
        {["confirmed", "failed"].includes(transaction.status) && (
          <button className="text-button" onClick={onDone}>
            Done
          </button>
        )}
      </div>
    </section>
  );
}

/** Claiming the handle other people will pay. */
export function TagClaim() {
  const w = useWallet();
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = w.tags[w.role];

  if (!w.wallet) return null;

  return (
    <section className="panel">
      <div className="section-title left">
        <h3>Your payment tag</h3>
      </div>
      {current ? (
        <p className="muted">
          People can pay this account by sending to <b>@{current.tag}</b> —{" "}
          {current.displayName}. No address needed.
        </p>
      ) : (
        <>
          <p className="muted">
            Claim a tag so people can pay you by name instead of by address.
            Claiming signs a message with this role&apos;s account, which is how
            the directory knows the tag is yours.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="form-stack">
            <label>
              Tag
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="bola"
                spellCheck={false}
              />
            </label>
            <label>
              Display name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bola the builder"
              />
            </label>
            <div className="milestone-actions">
              <button
                className="secondary"
                disabled={busy || tag.length < 3}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await w.claimTag(tag, name || tag);
                    setTag("");
                    setName("");
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not claim",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <AtSign size={15} />
                {busy ? "Claiming…" : "Claim this tag"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default Send;
