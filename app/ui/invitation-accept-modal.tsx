"use client";
import { useEffect, useState } from "react";
import { AlertCircle, ShieldCheck, ArrowRight, X } from "lucide-react";
import { useWallet } from "../wallet-context";
import { shortAddress } from "@/lib/chain";

export type InvitationDetails = {
  token: string;
  agreementId: string;
  role: string;
  targetTag: string | null;
  expiresAt: string;
  status: string;
  title: string;
  scope: string;
  payerAddress: string;
  workerAddress: string;
  verifierAddress: string;
};

export function InvitationAcceptModal({
  token,
  onClose,
  onAccepted,
}: {
  token: string;
  onClose: () => void;
  onAccepted: (agreementId: string) => void;
}) {
  const w = useWallet();
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/invitations?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Invitation could not be loaded.");
        }
        const data = await res.json();
        if (active) setDetails(data.invitation);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load invitation.");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchInvitation();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleAccept() {
    if (!details || !w.address) return;
    setAccepting(true);
    setError("");
    try {
      const res = await fetch("/api/invitations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: details.token,
          claimedAddress: w.address,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invitation.");
      }
      onAccepted(details.agreementId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="receipt-backdrop">
      <div className="panel modal-content dialog" style={{ maxWidth: "560px", width: "100%", margin: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <p className="eyebrow">AGREEMENT INVITATION</p>
            {details && <h1 style={{ margin: "4px 0 0", fontSize: "20px" }}>{details.title}</h1>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <p className="muted">Loading agreement invitation…</p>
          </div>
        ) : error ? (
          <div>
            <div role="alert" className="error-banner" style={{ marginBottom: "16px" }}>
              <AlertCircle size={16} /> {error}
            </div>
            <button className="secondary" onClick={onClose}>
              Dismiss
            </button>
          </div>
        ) : details ? (
          <div>
            <p className="muted" style={{ marginBottom: "20px", fontSize: "14px" }}>{details.scope}</p>

            <div className="panel" style={{ padding: "16px", marginTop: 0, marginBottom: "20px", background: "var(--m-surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                <span className="mono-label">Assigned Role:</span>
                <span className="badge" style={{ textTransform: "uppercase" }}>{details.role}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                <span className="mono-label">Created By (Payer):</span>
                <span className="mono">{shortAddress(details.payerAddress)}</span>
              </div>
              {details.targetTag && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span className="mono-label">Target Tag:</span>
                  <span>@{details.targetTag}</span>
                </div>
              )}
            </div>

            {!w.wallet ? (
              <div className="notice" style={{ flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ display: "flex", itemsCenter: "center", gap: "8px" }}>
                  <ShieldCheck size={18} />
                  <span>Sign in with your passkey identity to verify terms and accept this role.</span>
                </div>
                <a className="primary" href="/signin-with-chatgpt?return_to=/" style={{ textDecoration: "none" }}>
                  Sign in to Accrue <ArrowRight size={16} />
                </a>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button className="secondary" onClick={onClose} disabled={accepting}>
                  Decline
                </button>
                <button className="primary" onClick={handleAccept} disabled={accepting}>
                  {accepting ? "Accepting…" : `Accept as ${details.role}`}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
