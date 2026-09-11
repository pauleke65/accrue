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
export { Timeline } from "./timeline";
import { Timeline } from "./timeline";
import { Milestones } from "./milestones";
export default function Detail({
  agreement: a,
  role,
  onBack,
  onIntent,
}: {
  agreement: Agreement;
  role: Role;
  onBack: () => void;
  onIntent: (intent: Intent) => void;
}) {
  const expired = Date.now() >= Date.parse(a.expiry);
  const live = a.status === "active" && !expired;
  return (
    <>
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={16} />
        All agreements
      </button>
      <div className="page-heading">
        <div>
          <div className="section-title left">
            <Status value={expired && a.reserved > 0 ? "expired" : a.status} />
            <span className="fine-print">
              AGR-{a.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <h1>{a.title}</h1>
          <p className="muted">
            Agreed work. Clear accountability. Protected earnings.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() =>
            download(`accrue-${a.id}.json`, { mode: "sandbox", ...a })
          }
        >
          <Download size={16} />
          Export agreement
        </button>
      </div>
      <div className="metrics">
        <section className="metric featured">
          <span>Reserved for work</span>
          <strong>{money(a.reserved)}</strong>
          <small>Of {money(total(a))} total commitment</small>
        </section>
        <section className="metric">
          <span>Earned by your team</span>
          <strong>{money(a.earned.earner + a.earned.verifier)}</strong>
          <small>
            Worker {money(a.earned.earner)} · Verifier{" "}
            {money(a.earned.verifier)}
          </small>
        </section>
        <section className="metric">
          <span>Agreement expires</span>
          <strong className="date-value">{date(a.expiry)}</strong>
          <small>
            {new Date(a.expiry).toLocaleTimeString()} · your local time
          </small>
        </section>
      </div>
      {a.status === "awaiting" && (
        <div className="action-banner">
          <div>
            <h3>Everyone starts on the same page.</h3>
            <p>
              Accepted: {a.accepted.join(", ")}. Waiting for{" "}
              {requiredRoles(a)
                .filter((r) => !a.accepted.includes(r))
                .join(", ")}
              .
            </p>
          </div>
          {!a.accepted.includes(role) &&
            requiredRoles(a).includes(role) &&
            !expired && (
              <button
                className="primary"
                onClick={() => onIntent({ type: "accept" })}
              >
                Review & accept
              </button>
            )}
        </div>
      )}
      {a.status === "ready" && !expired && (
        <div className="action-banner">
          <div>
            <h3>The terms are accepted. Put the funding in place.</h3>
            <p>The agreement starts when the full commitment is reserved.</p>
          </div>
          {role === "payer" && (
            <button
              className="primary"
              onClick={() => onIntent({ type: "fund" })}
            >
              Fund {money(total(a))}
            </button>
          )}
        </div>
      )}
      {role !== "payer" && available(a, role) > 0 && (
        <div className="action-banner">
          <div>
            <h3>{money(available(a, role))} is yours to withdraw.</h3>
            <p>Already earned. Not affected by cancellation or expiry.</p>
          </div>
          <button
            className="primary"
            onClick={() => onIntent({ type: "withdraw" })}
          >
            Withdraw earnings <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      {role === "payer" &&
        (expired || a.status === "cancelled") &&
        a.reserved > 0 && (
          <div className="action-banner">
            <div>
              <h3>Unused funds are ready to return.</h3>
              <p>Earned allocations remain protected.</p>
            </div>
            <button
              className="primary"
              onClick={() => onIntent({ type: "refund" })}
            >
              Return {money(a.reserved)}
            </button>
          </div>
        )}
      <div className="detail-grid">
        <section>
          <Tabs defaultValue="milestones">
            <TabsList variant="line">
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="activity">Activity & receipts</TabsTrigger>
              <TabsTrigger value="terms">Agreed terms</TabsTrigger>
            </TabsList>
            <TabsContent value="milestones">
              <Milestones a={a} role={role} live={live} onIntent={onIntent} />
            </TabsContent>
            <TabsContent value="activity">
              <div className="panel">
                <Timeline agreement={a} />
              </div>
            </TabsContent>
            <TabsContent value="terms">
              <div className="panel form-stack">
                <h3>Scope of work</h3>
                <p className="pre-wrap muted">{a.scope}</p>
                <h3>Fixed terms · version 1</h3>
                <p className="muted">
                  All required roles accept this scope and the exact milestone
                  allocations before funding. Terms are not editable after
                  creation. To change them, mutually cancel unearned work and
                  create a new agreement.
                </p>
                <h3>Expiry and cancellation</h3>
                <p className="muted">
                  At expiry, submissions and approvals stop. The payer may
                  refund unused reserve. Earned funds never expire. Mutual
                  cancellation requires consent from{" "}
                  {requiredRoles(a).join(", ")}.
                </p>
                <h3>Verifier incentive disclosure</h3>
                <p className="muted">
                  Verifier fees are earned only on approval, not on rejected
                  inspections. This can create an incentive toward approval.
                  Accrue does not certify the professional or prove physical
                  completion.
                </p>
                {live && (
                  <>
                    <p className="fine-print">
                      Cancellation consent:{" "}
                      {a.cancelVotes.join(", ") || "None yet"}
                    </p>
                    <button
                      className="secondary"
                      disabled={
                        a.cancelVotes.includes(role) ||
                        !requiredRoles(a).includes(role)
                      }
                      onClick={() => onIntent({ type: "cancel" })}
                    >
                      {a.cancelVotes.includes(role)
                        ? "Your consent is recorded"
                        : "Consent to cancel unused work"}
                    </button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>
        <aside className="participant-panel">
          <h3>The people behind the work</h3>
          <div className="person">
            <span className="avatar">YO</span>
            <div>
              <b>You</b>
              <small>Payer · reserves the funds</small>
            </div>
          </div>
          <div className="person">
            <span className="avatar purple">
              {a.earner.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{a.earner}</b>
              <small>Worker · completes the work</small>
            </div>
          </div>
          {a.verifier && (
            <div className="person">
              <span className="avatar gold">
                {a.verifier.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <b>{a.verifier}</b>
                <small>Verifier · checks completion</small>
              </div>
            </div>
          )}
          <div className="protection">
            <ShieldCheck size={25} />
            <h3>Earned means earned.</h3>
            <p>
              Once a milestone is verified, its allocation stays with the worker
              and verifier—even after expiry.
            </p>
          </div>
          <p className="fine-print">
            Sandbox identities only. Switch roles in the top bar to explore each
            participant’s flow.
          </p>
        </aside>
      </div>
    </>
  );
}
