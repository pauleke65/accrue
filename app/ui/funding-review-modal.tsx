"use client";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { useWallet } from "../wallet-context";
import { formatAmount, token, escrow, shortAddress } from "@/lib/chain";
import type { LiveAgreement } from "../use-live-agreements";

export function FundingReviewModal({
  agreement,
  onClose,
  onConfirm,
  busy,
}: {
  agreement: LiveAgreement;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  busy: boolean;
}) {
  const w = useWallet();
  const balance = w.balances[w.role] ?? 0n;
  const deposit = agreement.chain.deposit;

  const hasBalance = balance >= deposit;

  return (
    <div className="receipt-backdrop">
      <div className="panel modal-content dialog" style={{ maxWidth: "560px", width: "100%", margin: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <p className="eyebrow">PRE-FLIGHT FUNDING REVIEW</p>
            <h1 style={{ margin: "4px 0 0", fontSize: "20px" }}>Fund Job #{agreement.onchainId}</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "14px" }}>{agreement.title}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="metrics" style={{ marginTop: 0, marginBottom: "20px" }}>
          <section className="metric featured">
            <span>Total Deposit Required</span>
            <strong>{formatAmount(deposit)} {token.symbol}</strong>
          </section>
          <section className="metric">
            <span>Your Current Balance</span>
            <strong style={{ color: hasBalance ? "var(--m-positive)" : "var(--m-negative)" }}>
              {formatAmount(balance)} {token.symbol}
            </strong>
          </section>
        </div>

        {!hasBalance && (
          <div role="alert" className="error-banner" style={{ marginBottom: "20px" }}>
            <AlertTriangle size={18} />
            <div>
              <strong>Insufficient AUSD balance.</strong> You need at least {formatAmount(deposit)} {token.symbol} to fund this job.
            </div>
          </div>
        )}

        <div className="panel" style={{ padding: "16px", marginTop: 0, marginBottom: "20px", background: "var(--m-surface)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
            <span className="mono-label">Payer Account:</span>
            <span className="mono">{shortAddress(agreement.payer)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
            <span className="mono-label">Worker Recipient:</span>
            <span>{agreement.workerTag ? `@${agreement.workerTag}` : shortAddress(agreement.worker)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
            <span className="mono-label">Verifier Approver:</span>
            <span>{agreement.verifierTag ? `@${agreement.verifierTag}` : shortAddress(agreement.verifier)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span className="mono-label">Smart Contract:</span>
            <span className="mono">{shortAddress(escrow.address)}</span>
          </div>
        </div>

        <div className="notice" style={{ marginBottom: "24px" }}>
          <ShieldCheck size={16} />
          <div>Funds are locked in the smart contract until work is verified and approved.</div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => void onConfirm()}
            disabled={busy || !hasBalance}
          >
            {busy ? "Funding On-Chain…" : `Fund ${formatAmount(deposit)} ${token.symbol}`}
          </button>
        </div>
      </div>
    </div>
  );
}
