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
export function Milestones({
  a,
  role,
  live,
  onIntent,
}: {
  a: Agreement;
  role: Role;
  live: boolean;
  onIntent: (i: Intent) => void;
}) {
  return (
    <div className="milestone-list">
      {a.milestones.map((m, i) => {
        const evidence = m.evidence.at(-1);
        const unlocked = a.milestones
          .slice(0, i)
          .every((item) => item.status === "approved");
        return (
          <article className="milestone" key={i}>
            <div className="milestone-heading">
              <span className={`step ${m.status === "approved" ? "done" : ""}`}>
                {m.status === "approved" ? (
                  <Check size={18} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <div>
                <Status value={m.status} />
                <h3>{m.title}</h3>
              </div>
              <strong>{money(m.amount + m.fee)}</strong>
            </div>
            <p className="criteria">{m.criteria}</p>
            <div className="allocation">
              <span>
                Worker <b>{money(m.amount)}</b>
              </span>
              <span>
                Verifier <b>{money(m.fee)}</b>
              </span>
              <span>
                Approved by{" "}
                <b>{m.approver === "payer" ? "You, the payer" : a.verifier}</b>
              </span>
            </div>
            {m.feedback && m.status === "changes" && (
              <div className="notice amber">
                <p>Requested changes: {m.feedback}</p>
              </div>
            )}
            {evidence && (
              <details className="evidence">
                <summary>
                  <FileText size={16} />
                  Evidence v{evidence.version} · {date(evidence.at)}
                </summary>
                <p className="pre-wrap">{evidence.notes}</p>
                <code className="digest">{evidence.digest}</code>
                {evidence.files.map((id, index) => (
                  <a
                    key={id}
                    href={`/api/evidence?id=${id}`}
                    className="file-link"
                  >
                    Download attachment {index + 1}
                    <Download size={14} />
                  </a>
                ))}
                {m.evidence.length > 1 && (
                  <p className="fine-print">
                    {m.evidence.length - 1} earlier version(s) preserved in the
                    agreement export.
                  </p>
                )}
              </details>
            )}
            <div className="milestone-actions">
              {live &&
                unlocked &&
                role === "earner" &&
                ["waiting", "changes"].includes(m.status) && (
                  <button
                    className="primary"
                    onClick={() => onIntent({ type: "submit", milestone: i })}
                  >
                    {m.status === "changes"
                      ? "Resubmit evidence"
                      : "Submit evidence"}
                    <ArrowUpRight size={15} />
                  </button>
                )}
              {live && role === m.approver && m.status === "submitted" && (
                <>
                  <button
                    className="primary"
                    onClick={() => onIntent({ type: "approve", milestone: i })}
                  >
                    Approve work <Check size={16} />
                  </button>
                  <button
                    className="secondary"
                    onClick={() => onIntent({ type: "changes", milestone: i })}
                  >
                    Request changes
                  </button>
                </>
              )}
              {m.status === "approved" && role === m.approver && (
                <button
                  className="text-button"
                  onClick={() => onIntent({ type: "correct", milestone: i })}
                >
                  Append correction
                </button>
              )}
              {!unlocked && m.status === "waiting" && (
                <span className="fine-print">
                  <Clock size={13} /> Unlocks after the preceding milestone
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
