"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Check,
  FileText,
  Handshake,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Wallet,
} from "lucide-react";
import { useWallet } from "../wallet-context";
import { formatAmount, shortAddress, explorer, token } from "@/lib/chain";
import { When } from "./receipt";

/**
 * The funded-job activity feed, read from the escrow contract's own events.
 *
 * Every line here is something the contract recorded, not something the app
 * inferred — an acceptance, a funded deposit, a submission, an approval that
 * moved money, a withdrawal, a correction. It is a history, not a trust
 * score: a correction count does not prove wrongdoing, and an approval count
 * does not prove the underlying work happened. A named verifier's judgement
 * is what stands behind that, not this record.
 */

type Entry = {
  hash: string;
  logIndex: number;
  at: string;
  kind:
    | "created"
    | "accepted"
    | "funded"
    | "evidence"
    | "changes"
    | "approved"
    | "withdrawn"
    | "cancel-consent"
    | "refunded"
    | "correction";
  agreementId: string;
  agreementTitle: string;
  milestoneTitle?: string;
  actor?: string;
  amount?: string;
  workerAmount?: string;
  verifierFee?: string;
};

const ICON: Record<Entry["kind"], React.ReactNode> = {
  created: <FileText size={12} />,
  accepted: <Handshake size={12} />,
  funded: <Wallet size={12} />,
  evidence: <FileText size={12} />,
  changes: <PenLine size={12} />,
  approved: <Check size={12} />,
  withdrawn: <Banknote size={12} />,
  "cancel-consent": <ShieldAlert size={12} />,
  refunded: <Undo2 size={12} />,
  correction: <PenLine size={12} />,
};

function describe(e: Entry): string {
  const who = e.actor ? shortAddress(e.actor) : "";
  switch (e.kind) {
    case "created":
      return "Agreement created on chain.";
    case "accepted":
      return `${who} accepted the terms.`;
    case "funded":
      return `Funded with ${formatAmount(BigInt(e.amount ?? "0"))} ${token.symbol}.`;
    case "evidence":
      return `Evidence submitted for ${e.milestoneTitle ?? "a milestone"}.`;
    case "changes":
      return `Changes requested on ${e.milestoneTitle ?? "a milestone"}.`;
    case "approved":
      return `${e.milestoneTitle ?? "Milestone"} approved by ${who}. Worker and verifier allocations credited.`;
    case "withdrawn":
      return `${who} withdrew ${formatAmount(BigInt(e.amount ?? "0"))} ${token.symbol}.`;
    case "cancel-consent":
      return `${who} consented to cancellation.`;
    case "refunded":
      return `Unused reserve of ${formatAmount(BigInt(e.amount ?? "0"))} ${token.symbol} returned to the payer.`;
    case "correction":
      return `Correction recorded by ${who} for ${e.milestoneTitle ?? "a milestone"}.`;
  }
}

export function LiveActivity({ onOpen }: { onOpen: (id: string) => void }) {
  const w = useWallet();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  // Starts true rather than being set true from inside the effect: this
  // component fetches once on mount and never needs to re-enter a loading
  // state afterward, so there is nothing to synchronously flip on — only
  // ever back off, from within the async response handling below.
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (cancelledRef: { current: boolean }) => {
      try {
        // Same participant proof as the agreements list itself, so a real
        // worker or verifier sees activity for jobs someone else created —
        // see lib/live-agreements-access.ts for why this is necessary.
        const proofs = w.wallet ? await w.proveParticipation() : [];
        const query = proofs.length
          ? `?proofs=${encodeURIComponent(JSON.stringify(proofs))}`
          : "";
        const response = await fetch(`/api/escrow-activity${query}`);
        const data = (await response.json()) as {
          configured: boolean;
          entries?: Entry[];
        };
        if (cancelledRef.current) return;
        setConfigured(data.configured);
        setEntries(data.entries ?? []);
      } catch {
        if (!cancelledRef.current) setConfigured(false);
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    },
    [w],
  );

  useEffect(() => {
    if (!w.wallet) return;
    const cancelledRef = { current: false };
    // The newer react-hooks lint rule flags any effect that calls a function
    // which eventually calls setState, even after an await — a pattern this
    // codebase already uses for every other fetch-on-mount hook (see
    // useLiveAgreements). Fixing that properly means adopting a real
    // data-fetching layer everywhere at once, which is well beyond this
    // page; suppressed here to match the existing, working convention rather
    // than silently diverge from it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [w.wallet, load]);

  if (!w.wallet)
    return (
      <div className="empty-state">
        <Activity />
        <h2>Sign in to see your activity.</h2>
        <p>
          Every entry is read from the escrow contract&apos;s own event log.
        </p>
      </div>
    );

  const approvals = entries.filter((e) => e.kind === "approved").length;
  const corrections = entries.filter((e) => e.kind === "correction").length;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A SHARED RECORD</p>
          <h1>Activity & attestations</h1>
          <p className="muted">
            Every decision, allocation, and correction, read from the contract
            that enforced them.
          </p>
        </div>
      </div>

      <div className="notice">
        <p>
          {approvals} attestation{approvals === 1 ? "" : "s"} · {corrections}{" "}
          correction{corrections === 1 ? "" : "s"}. This is a count of on-chain
          activity, not a trust score or proof of professional credentials.
        </p>
      </div>

      {configured === false && (
        <div className="notice">
          <ShieldCheck size={17} />
          <p>
            Add an Envio API token to read this feed from the chain. See
            Connections for what is currently active.
          </p>
        </div>
      )}

      {loading && <p className="muted">Reading the network…</p>}

      {!loading && entries.length ? (
        <div className="timeline">
          {entries.map((e) => (
            <div className="timeline-entry" key={`${e.hash}-${e.logIndex}`}>
              <span className="timeline-dot">{ICON[e.kind]}</span>
              <div>
                <div className="section-title">
                  <b>{describe(e)}</b>
                  {e.kind === "approved" && (
                    <strong>
                      {formatAmount(
                        BigInt(e.workerAmount ?? "0") +
                          BigInt(e.verifierFee ?? "0"),
                      )}
                    </strong>
                  )}
                </div>
                <p className="fine-print">
                  {e.agreementTitle} · <When iso={e.at} />
                </p>
                <div className="milestone-actions">
                  <button
                    className="text-button"
                    onClick={() => onOpen(e.agreementId)}
                  >
                    Open job
                  </button>
                  <a
                    className="text-button"
                    href={explorer.tx(e.hash)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    View on chain <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading &&
        configured !== false && (
          <div className="empty-state">
            <Activity />
            <h2>No activity yet.</h2>
            <p>Fund a job and this fills in as it happens.</p>
          </div>
        )
      )}
    </>
  );
}
