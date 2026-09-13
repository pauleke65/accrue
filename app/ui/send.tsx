"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, AtSign, Check, Copy, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWallet } from "../wallet-context";
import { sendAusd, requestFaucetDrip } from "@/lib/ausd";
import {
  formatAmount,
  parseAmount,
  shortAddress,
  token,
  network,
  type TransactionState,
} from "@/lib/chain";
import { Receipt, PaymentsTable, type PaymentRecord } from "./receipt";

/**
 * Sending money to a person rather than to an address.
 *
 * A tag is a directory entry, not a different kind of payment: it resolves to
 * an account address and the transfer that follows is an ordinary on-chain
 * transfer, so an address still works. But the tag is what someone shares, so
 * it leads the page rather than hiding in a settings panel.
 */
export function Send() {
  const w = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TransactionState>({
    status: "idle",
  });
  const [resolved, setResolved] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [open, setOpen] = useState<PaymentRecord | null>(null);

  const balance = w.balances[w.role];
  const gas = w.gas[w.role];

  const loadPayments = useCallback(async () => {
    try {
      const response = await fetch("/api/payments");
      if (!response.ok) return;
      const data = (await response.json()) as { payments: PaymentRecord[] };
      setPayments(data.payments);
    } catch {
      // The ledger is a convenience; failing to load it must not break paying.
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  async function send() {
    if (!w.account || !w.address) return;
    setBusy(true);
    setLocalError("");
    setResolved(null);
    try {
      const raw = to.trim();
      let target: `0x${string}`;
      let tag: string | null = null;
      if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
        target = raw as `0x${string}`;
      } else {
        const found = await w.resolveTag(raw);
        if (!found)
          throw new Error(
            `Nobody here goes by ${raw.startsWith("@") ? raw : `@${raw}`} yet.`,
          );
        target = found.address;
        tag = raw.replace(/^@/, "").toLowerCase();
        setResolved(`${found.displayName} · ${shortAddress(found.address)}`);
      }
      const value = parseAmount(amount);
      // Cover the network fee before asking for a signature, so a first-time
      // account is not stopped at the last step by a cost it cannot see.
      if (gas !== null && gas === 0n) await w.ensureGas();

      const state = await sendAusd({
        account: w.account,
        to: target,
        amount: value,
        report: setProgress,
      });

      if (state.hash) {
        await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hash: state.hash,
            from: w.address,
            to: target,
            toTag: tag,
            amount: value.toString(),
            status: state.status === "confirmed" ? "confirmed" : "pending",
          }),
        }).catch(() => undefined);
        await loadPayments();
      }
      if (state.status !== "failed") {
        await w.refresh();
        setAmount("");
        setTo("");
      }
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Claiming test money must work on an account holding nothing at all, which
   * is the state every new account starts in. The sponsor pays that fee.
   */
  async function drip() {
    setBusy(true);
    setLocalError("");
    try {
      await w.sponsorTokens();
    } catch (cause) {
      if (w.account && gas !== null && gas > 0n) {
        const state = await requestFaucetDrip({
          account: w.account,
          report: setProgress,
        });
        if (state.status !== "failed") await w.refresh();
      } else {
        setLocalError(
          cause instanceof Error ? cause.message : "Could not get test money.",
        );
      }
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
          One passkey opens your account. Nothing to install, and no seed phrase
          to keep safe.
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
            Send to a tag like @bola. Money arrives in seconds, and every
            payment leaves a receipt.
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

      <TagCard />

      <div className="metrics">
        <section className="metric featured">
          <div className="section-title">
            <span>Balance</span>
            <Wallet size={17} />
          </div>
          <strong>{balance === null ? "—" : formatAmount(balance)}</strong>
          <small>
            {token.symbol} · {w.role}
          </small>
        </section>
        <section className="metric">
          <span>Network fees</span>
          <strong>
            {gas === null ? "—" : (Number(gas) / 1e18).toFixed(3)}
          </strong>
          <small>
            {gas === 0n
              ? "Covered for you on your first payment."
              : "MON, covering the cost of sending."}
          </small>
        </section>
        <section className="metric">
          <span>Payments sent</span>
          <strong>{payments.length}</strong>
          <small>Through this workspace.</small>
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
              disabled={busy || !to || !amount}
              onClick={() => void send()}
            >
              <ArrowUpRight size={16} />
              {busy
                ? progress.status === "submitted"
                  ? "Confirming…"
                  : "Sending…"
                : `Send ${token.symbol}`}
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

      <section className="panel">
        <div className="section-title">
          <h2>Payments</h2>
          <button className="text-button" onClick={() => void loadPayments()}>
            Refresh
          </button>
        </div>
        <PaymentsTable payments={payments} onOpen={setOpen} />
        <p className="fine-print">
          Payments sent through this workspace. The network caps history
          lookups, so this is Accrue&apos;s own record, with each entry checked
          against the network.
        </p>
      </section>

      {open && <Receipt payment={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The handle other people use to pay you — the thing worth sharing. */
export function TagCard() {
  const w = useWallet();
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const current = w.tags[w.role];

  if (!w.wallet) return null;

  if (current)
    return (
      <section className="tag-card">
        <div>
          <p className="mono-label">Your payment tag</p>
          <h2 className="tag-handle">@{current.tag}</h2>
          <p className="muted">
            {current.displayName} · {shortAddress(w.address ?? "0x")}
          </p>
        </div>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`@${current.tag}`);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Share tag"}
        </button>
      </section>
    );

  return (
    <section className="tag-card is-empty">
      <div className="tag-card-body">
        <p className="mono-label">Your payment tag</p>
        <h2>Claim a name people can pay.</h2>
        <p className="muted">
          A tag replaces a long account address. Claiming signs a message with
          this account, which is how the directory knows the tag is yours.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="tag-claim">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="bola"
            aria-label="Tag"
            spellCheck={false}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bola the builder"
            aria-label="Display name"
          />
          <button
            className="primary"
            disabled={busy || tag.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await w.claimTag(tag, name || tag);
                setTag("");
                setName("");
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Could not claim",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <AtSign size={15} />
            {busy ? "Claiming…" : "Claim"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default Send;
