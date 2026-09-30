"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Copy, ShieldCheck, X, Check } from "lucide-react";
import { shortAddress } from "@/lib/chain";

export function ProfileCard({
  tag,
  address,
  onClose,
}: {
  tag: string;
  address?: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(address ?? null);
  const [displayName, setDisplayName] = useState<string>(tag);
  const [loading, setLoading] = useState(!address);

  useEffect(() => {
    let active = true;
    async function resolveTag() {
      if (address) return;
      const clean = tag.replace(/^@/, "").trim().toLowerCase();
      try {
        const res = await fetch(`/api/tags?tag=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = (await res.json()) as {
            found?: boolean;
            address?: string;
            displayName?: string;
          };
          if (active && data.found && data.address) {
            setResolvedAddress(data.address);
            if (data.displayName) setDisplayName(data.displayName);
          }
        }
      } catch {
        /* ignore fallback */
      } finally {
        if (active) setLoading(false);
      }
    }
    resolveTag();
    return () => {
      active = false;
    };
  }, [tag, address]);

  async function handleCopy() {
    if (!resolvedAddress) return;
    await navigator.clipboard.writeText(resolvedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cleanTag = tag.replace(/^@/, "");

  return (
    <div className="receipt-backdrop">
      <div className="panel modal-content dialog" style={{ maxWidth: "420px", width: "100%", margin: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <p className="eyebrow">PARTICIPANT PROFILE</p>
            <h1 style={{ margin: "4px 0 0", fontSize: "20px" }}>@{cleanTag}</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "14px" }}>{displayName}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="panel" style={{ padding: "16px", marginTop: 0, marginBottom: "20px", background: "var(--m-surface)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", fontSize: "13px" }}>
            <span className="mono-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={15} /> Identity Type:
            </span>
            <span className="mono" style={{ color: "var(--m-purple-bright)" }}>Passkey WebAuthn</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--m-hairline)", fontSize: "13px" }}>
            <span className="mono-label">EVM Address:</span>
            {loading ? (
              <span className="muted text-xs">Resolving…</span>
            ) : resolvedAddress ? (
              <button
                className="text-button mono"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                onClick={handleCopy}
              >
                {shortAddress(resolvedAddress)}{" "}
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            ) : (
              <span className="muted text-xs">Unresolved</span>
            )}
          </div>
        </div>

        <div className="notice" style={{ marginBottom: "20px" }}>
          <ShieldCheck size={16} />
          <div>Participant identities are passkey-bound and verified on Monad.</div>
        </div>

        <div className="milestone-actions">
          <a className="primary" href={`/u/${tag.replace(/^@/, "")}`} target="_blank" rel="noreferrer noopener">
            See verified work <ArrowUpRight size={14} aria-hidden />
          </a>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
