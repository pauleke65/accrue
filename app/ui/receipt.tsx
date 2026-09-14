"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";
import {
  formatAmount,
  shortAddress,
  explorer,
  token,
  network,
} from "@/lib/chain";
import { publicClient } from "@/lib/ausd";

/**
 * A payment receipt as a document rather than a link.
 *
 * Someone who has just paid a builder in Lagos wants to see who was paid, how
 * much, and that it went through. The chain reference belongs on it — it is
 * what makes the receipt checkable — but as a footnote, not as the thing the
 * reader has to click to find out what happened.
 */

export type PaymentRecord = {
  hash: `0x${string}`;
  from: string;
  to: string;
  toTag: string | null;
  amount: string;
  status: string;
  at: string;
};

/**
 * Dates are rendered twice: once identically on the server and the first
 * client pass, then again in the reader's own timezone after mount. Formatting
 * straight to a local string would make the two passes disagree, because the
 * server's locale and timezone are not the reader's.
 */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function stable(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function When({ iso }: { iso: string }) {
  const [text, setText] = useState(() => stable(iso));
  useEffect(() => {
    setText(
      new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [iso]);
  return <>{text}</>;
}

export function Receipt({
  payment,
  onClose,
}: {
  payment: PaymentRecord;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fee, setFee] = useState<string | null>(null);

  // The network fee is on the receipt because a payer is entitled to know what
  // the transfer cost, not only what it moved.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const receipt = await publicClient().getTransactionReceipt({
          hash: payment.hash,
        });
        const cost = receipt.gasUsed * receipt.effectiveGasPrice;
        if (!cancelled) setFee(`${(Number(cost) / 1e18).toFixed(5)} MON`);
      } catch {
        if (!cancelled) setFee(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payment.hash]);

  const paid = payment.status === "confirmed";

  return (
    <div
      className="receipt-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Payment receipt"
    >
      <article className="receipt">
        <button
          className="receipt-close"
          onClick={onClose}
          aria-label="Close receipt"
        >
          <X size={18} />
        </button>

        <header className="receipt-head">
          <span className="receipt-brand">Accrue</span>
          <span
            className={`receipt-status ${paid ? "is-paid" : payment.status === "failed" ? "is-failed" : "is-pending"}`}
          >
            {paid
              ? "Paid"
              : payment.status === "failed"
                ? "Not paid"
                : "Pending"}
          </span>
        </header>

        <div className="receipt-amount">
          <span className="receipt-currency">{token.symbol}</span>
          <strong>{formatAmount(BigInt(payment.amount))}</strong>
        </div>

        <div className="receipt-parties">
          <div>
            <span className="mono-label">From</span>
            <b>{shortAddress(payment.from)}</b>
          </div>
          <div className="receipt-arrow" aria-hidden="true">
            →
          </div>
          <div>
            <span className="mono-label">To</span>
            <b>
              {payment.toTag ? `@${payment.toTag}` : shortAddress(payment.to)}
            </b>
            {payment.toTag && (
              <small className="receipt-sub">{shortAddress(payment.to)}</small>
            )}
          </div>
        </div>

        <dl className="receipt-lines">
          <div>
            <dt>Date</dt>
            <dd>
              <When iso={payment.at} />
            </dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{network.name}</dd>
          </div>
          <div>
            <dt>Network fee</dt>
            <dd>{fee ?? "—"}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd className="receipt-reference">
              <span>
                {payment.hash.slice(0, 10)}…{payment.hash.slice(-8)}
              </span>
              <button
                className="icon-button"
                aria-label="Copy the full reference"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(payment.hash);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </dd>
          </div>
        </dl>

        <footer className="receipt-foot">
          <p>
            Test money on {network.name}. This receipt records a transfer of{" "}
            {token.symbol}; it is not a bank payment.
          </p>
          <a
            href={explorer.tx(payment.hash)}
            target="_blank"
            rel="noreferrer noopener"
          >
            Check it on the network <ArrowUpRight size={12} />
          </a>
        </footer>
      </article>
    </div>
  );
}

export function PaymentsTable({
  payments,
  onOpen,
}: {
  payments: PaymentRecord[];
  onOpen: (payment: PaymentRecord) => void;
}) {
  if (!payments.length)
    return (
      <p className="muted">
        Payments you send will appear here with their receipts.
      </p>
    );

  return (
    <div className="table-scroll">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">To</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col" className="right">
              Amount
            </th>
            <th scope="col">
              <span className="sr-only">Receipt</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.hash}>
              <td>
                <b>{p.toTag ? `@${p.toTag}` : shortAddress(p.to)}</b>
              </td>
              <td className="muted-cell">
                <When iso={p.at} />
              </td>
              <td>
                <span
                  className={`pill ${p.status === "confirmed" ? "is-paid" : p.status === "failed" ? "is-failed" : "is-pending"}`}
                >
                  {p.status === "confirmed"
                    ? "Paid"
                    : p.status === "failed"
                      ? "Failed"
                      : "Pending"}
                </span>
              </td>
              <td className="right amount-cell">
                {formatAmount(BigInt(p.amount))}
              </td>
              <td className="right">
                <button className="text-button" onClick={() => onOpen(p)}>
                  Receipt
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
