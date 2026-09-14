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
  GAS_TOPUP_THRESHOLD,
  type TransactionState,
} from "@/lib/chain";
import { Receipt, PaymentsTable, type PaymentRecord } from "./receipt";
import { TagField } from "./tag-field";

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
  const [source, setSource] = useState<"own" | "envio">("own");

  const balance = w.balances[w.role];
  const gas = w.gas[w.role];

  /**
   * History comes from the chain where it can.
   *
   * The app's own record only knows what it saw; an account that was paid
   * somewhere else, or before this workspace existed, would show nothing. Envio
   * answers over the whole chain, which the plain RPC cannot do at all — it
   * caps log queries at a hundred blocks. Where the indexer is configured it
   * leads, and the app's records fill in what is still pending.
   */
  const loadPayments = useCallback(async () => {
    const own = await fetch("/api/payments")
      .then((r) => (r.ok ? r.json() : { payments: [] }))
      .catch(() => ({ payments: [] }));
    // /api/payments is scoped to this workspace, not to any one role: a
    // signed-in owner drives three separate signing addresses (payer, worker,
    // verifier), and the same table holds rows recorded from any of them
    // across every session. Rendering it unfiltered would show one role's
    // ledger what another role sent — the exact cross-role bleed the three
    // separate accounts exist to prevent. Only rows this address actually
    // sent belong in its own list.
    const workspaceRows = (own as { payments: PaymentRecord[] }).payments ?? [];
    const mine = w.address
      ? workspaceRows.filter(
          (p) => p.from.toLowerCase() === w.address!.toLowerCase(),
        )
      : [];

    if (!w.address) {
      setPayments(mine);
      return;
    }

    try {
      const response = await fetch(`/api/history?address=${w.address}`);
      const data = (await response.json()) as {
        configured?: boolean;
        transfers?: {
          hash: string;
          from: string;
          to: string;
          amount: string;
          at: number | null;
          direction: string;
          counterpartyIsEscrow: boolean;
        }[];
      };
      if (!data.configured || !data.transfers) {
        setSource("own");
        setPayments(mine);
        return;
      }

      // Tags the app knows about make the chain's addresses readable again.
      // This lookup can safely draw on every tag the workspace has recorded
      // a destination for, regardless of which role sent it — it only maps
      // an address to a name, never attributes a payment to the wrong role.
      const tagFor = new Map(
        workspaceRows.map((p) => [p.to.toLowerCase(), p.toTag]),
      );
      const pendingByHash = new Map(mine.map((p) => [p.hash.toLowerCase(), p]));

      const fromChain: PaymentRecord[] = data.transfers
        .filter((t) => t.direction === "out" && !t.counterpartyIsEscrow)
        .map((t) => ({
          hash: t.hash as `0x${string}`,
          from: t.from,
          to: t.to,
          toTag: tagFor.get(t.to.toLowerCase()) ?? null,
          amount: t.amount,
          status: "confirmed",
          at: t.at
            ? new Date(t.at * 1000).toISOString()
            : (pendingByHash.get(t.hash.toLowerCase())?.at ??
              new Date().toISOString()),
        }));

      // Anything the app sent that the chain has not shown yet is still real.
      const seen = new Set(fromChain.map((p) => p.hash.toLowerCase()));
      const stillPending = mine.filter((p) => !seen.has(p.hash.toLowerCase()));

      setSource("envio");
      setPayments(
        [...fromChain, ...stillPending].sort((a, b) =>
          a.at < b.at ? 1 : a.at > b.at ? -1 : 0,
        ),
      );
    } catch {
      setSource("own");
      setPayments(mine);
    }
  }, [w.address]);

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
      // Cover the network fee before asking for a signature. Match the
      // sponsor's own idea of "enough" — an account that has some MON left
      // from an earlier send but not enough for this one must still be
      // topped up, not only one sitting at exactly zero.
      if (gas !== null && gas < GAS_TOPUP_THRESHOLD) await w.ensureGas();

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
            {gas !== null && gas < GAS_TOPUP_THRESHOLD
              ? "Covered for you when you next send."
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
          {/^0x/.test(to.trim()) ? (
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
          ) : (
            <TagField
              label="To"
              value={to}
              onChange={(next) => {
                setTo(next);
                setResolved(null);
              }}
              placeholder="@bola, or an account address"
            />
          )}
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
          {source === "envio"
            ? "Read from the chain with Envio, so this covers payments made anywhere — not only the ones sent from here."
            : "Accrue's own record of what it sent. The network caps history lookups at a hundred blocks, so without an indexer this cannot cover payments made elsewhere."}
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
