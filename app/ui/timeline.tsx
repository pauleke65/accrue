"use client";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  ShieldCheck,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Agreement, Role, Entry } from "@/lib/domain";
import { available, requiredRoles, total } from "@/lib/domain";
import { money, date, Status, download } from "./shared";
import type { Intent } from "./action-dialog";
export function Timeline({ agreement }: { agreement: Agreement }) {
  return (
    <div className="timeline">
      {[...agreement.timeline].reverse().map((entry) => (
        <div className="timeline-entry" key={entry.id}>
          <span className="timeline-dot">
            <Check size={12} />
          </span>
          <div>
            <div className="section-title">
              <b>{entry.message}</b>
              {entry.amount > 0 && <strong>{money(entry.amount)}</strong>}
            </div>
            <p className="fine-print">
              {entry.actor} · {new Date(entry.at).toLocaleString()}
            </p>
            {entry.digest && (
              <code className="digest">SHA-256 · {entry.digest}</code>
            )}
            {entry.amount > 0 && (
              <button
                className="text-button"
                onClick={() => receipt(agreement, entry)}
              >
                <Download size={13} />
                Download sandbox receipt
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
function receipt(a: Agreement, e: Entry) {
  download(`accrue-receipt-${e.id}.json`, {
    product: "Accrue",
    mode: "SANDBOX — NO REAL FUNDS",
    network: null,
    token: null,
    transactionHash: null,
    operationId: e.id,
    agreementId: a.id,
    agreement: a.title,
    currency: "USD sandbox units",
    amountCents: e.amount,
    actor: e.actor,
    action: e.action,
    evidenceDigest: e.digest ?? null,
    at: e.at,
    message: e.message,
    worker: a.earner,
    verifier: a.verifier,
  });
}
