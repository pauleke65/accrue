"use client";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Plus, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagField } from "./tag-field";
import { useWallet } from "../wallet-context";
import {
  useLiveAgreements,
  roleOf,
  hasAccepted,
  readyToFund,
  requiredAcceptances,
  type Draft,
  type LiveAgreement,
} from "../use-live-agreements";
import {
  formatAmount,
  shortAddress,
  token,
  explorer,
  escrow,
} from "@/lib/chain";

/**
 * Milestone agreements funded with real AUSD through the deployed escrow.
 *
 * Every figure shown here was read from the contract. What the app supplies is
 * the readable half — the scope and the acceptance criteria the contract holds
 * only as hashes — so people can see what they agreed to rather than a digest.
 */

const emptyDraft: Draft = {
  title: "",
  scope: "",
  workerTag: "",
  verifierTag: "",
  days: 14,
  milestones: [{ title: "", criteria: "", amount: "", fee: "" }],
};

export function LiveAgreements() {
  const w = useWallet();
  const live = useLiveAgreements();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!w.wallet)
    return (
      <div className="empty-state">
        <ShieldCheck />
        <h2>Sign in to fund a job.</h2>
        <p>
          Agreements hold {token.symbol} in a contract until work is verified.
          One passkey opens the accounts that sign for each role.
        </p>
      </div>
    );

  const selected = live.agreements.find((a) => a.id === open) ?? null;

  // Derived rather than stored: switching role mid-draft closes the builder
  // without a state write during render.
  if (creating && w.role === "payer")
    return (
      <Builder
        busy={live.busy}
        error={live.error}
        onCancel={() => setCreating(false)}
        onCreate={async (draft) => {
          const id = await live.create(draft);
          if (id !== null) setCreating(false);
        }}
      />
    );

  if (selected)
    return (
      <Detail agreement={selected} live={live} onBack={() => setOpen(null)} />
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Funded work</p>
          <h1>Jobs held in escrow.</h1>
          <p className="muted">
            {token.symbol} is held by the contract until the agreed verifier
            confirms the work. Nobody, including us, can move it another way.
          </p>
        </div>
        {/* Creating a job means committing the money for it, so only the
            payer can start one. The other roles are invited into a job; they
            do not open one. */}
        {w.role === "payer" && (
          <button className="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Fund a job
          </button>
        )}
      </div>

      {live.error && (
        <div role="alert" className="error-banner">
          {live.error}
          <button className="text-button" onClick={() => live.setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {live.loading && <p className="muted">Reading the network…</p>}

      {!live.loading && !live.agreements.length ? (
        <div className="empty-state">
          <ShieldCheck />
          <h2>
            {w.role === "payer"
              ? "No funded jobs yet."
              : `Nothing to ${w.role === "worker" ? "work on" : "verify"} yet.`}
          </h2>
          <p>
            {w.role === "payer"
              ? `Fund one and the ${token.symbol} sits in the contract until the work is verified.`
              : "A job appears here once someone funds one and names you in it."}
          </p>
          {w.role === "payer" && (
            <button className="secondary" onClick={() => setCreating(true)}>
              Fund a job <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      ) : (
        <div className="agreement-grid">
          {live.agreements.map((a) => {
            const done = a.states.filter((s) => s === 2).length;
            return (
              <button
                className="agreement-tile"
                key={a.id}
                onClick={() => setOpen(a.id)}
              >
                <div className="tile-head">
                  <span className="badge">{status(a)}</span>
                  <span className="tile-amount">
                    {formatAmount(a.chain.deposit)}
                  </span>
                </div>
                <div>
                  <h2 className="tile-title">{a.title}</h2>
                  <p className="tile-meta">
                    {a.workerTag ? `@${a.workerTag}` : shortAddress(a.worker)}
                    {a.verifierTag ? ` · verified by @${a.verifierTag}` : ""}
                  </p>
                </div>
                <div
                  className="tile-progress"
                  role="img"
                  aria-label={`${done} of ${a.milestones.length} milestones complete`}
                >
                  <span
                    style={{ width: `${(done / a.milestones.length) * 100}%` }}
                  />
                </div>
                <div className="tile-foot">
                  <span>
                    {done} / {a.milestones.length} milestones
                  </span>
                  <ArrowUpRight size={16} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="bottom-note">
        <ShieldCheck size={16} />
        Held by contract {shortAddress(escrow.address)} · every figure read from
        the network
      </div>
    </>
  );
}

function status(a: LiveAgreement): string {
  if (a.chain.cancelled) return "Cancelled";
  if (!a.chain.funded) return "Awaiting funding";
  if (a.chain.reserved === 0n) return "Complete";
  if (a.states.some((s) => s === 1)) return "Awaiting review";
  return "In progress";
}

function Detail({
  agreement,
  live,
  onBack,
}: {
  agreement: LiveAgreement;
  live: ReturnType<typeof useLiveAgreements>;
  onBack: () => void;
}) {
  const w = useWallet();
  const [notes, setNotes] = useState("");
  const acting = roleOf(agreement, w.address);
  const a = agreement.chain;

  const owed =
    acting === "worker"
      ? a.workerEarned - a.workerWithdrawn
      : acting === "verifier"
        ? a.verifierEarned - a.verifierWithdrawn
        : 0n;

  return (
    <>
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={15} /> All jobs
      </button>

      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {status(agreement)} · on {token.symbol}
          </p>
          <h1>{agreement.title}</h1>
          <p className="muted">{agreement.scope}</p>
        </div>
      </div>

      {live.error && (
        <div role="alert" className="error-banner">
          {live.error}
          <button className="text-button" onClick={() => live.setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {acting === null && (
        <div className="notice">
          <ShieldCheck size={17} />
          <div>
            The role you have selected is not part of this agreement. Switch to
            the role that is, and the contract will accept its signature.
          </div>
        </div>
      )}

      <div className="metrics">
        <section className="metric featured">
          <div className="section-title">
            <span>Reserved for work</span>
            <ShieldCheck size={17} />
          </div>
          <strong>{formatAmount(a.reserved)}</strong>
          <small>
            {token.symbol} of {formatAmount(a.deposit)} committed
          </small>
        </section>
        <section className="metric">
          <span>Earned</span>
          <strong>{formatAmount(a.workerEarned + a.verifierEarned)}</strong>
          <small>
            Worker {formatAmount(a.workerEarned)} · verifier{" "}
            {formatAmount(a.verifierEarned)}
          </small>
        </section>
        <section className="metric">
          <span>Yours to withdraw</span>
          <strong>{formatAmount(owed)}</strong>
          <small>
            {owed > 0n
              ? "Protected once approved."
              : "Nothing waiting for this role."}
          </small>
        </section>
      </div>

      {/* Acceptance and funding come before any work. */}
      {!a.funded && (
        <section className="action-banner">
          <div>
            <h3>
              {acting && !hasAccepted(agreement, acting)
                ? "Review and accept these terms."
                : "Waiting on the others."}
            </h3>
            <p>
              Accepted so far:{" "}
              {(["payer", "worker", "verifier"] as const)
                .filter((r) => hasAccepted(agreement, r))
                .join(", ") || "nobody"}
              . Funding moves {formatAmount(a.deposit)} {token.symbol} into the
              contract.
            </p>
          </div>
          <div className="milestone-actions">
            {acting && !hasAccepted(agreement, acting) && (
              <button
                className="primary"
                disabled={live.busy}
                onClick={() => void live.accept(agreement)}
              >
                Accept terms
              </button>
            )}
            {acting === "payer" && (
              <button
                className="secondary"
                disabled={live.busy || !readyToFund(agreement)}
                title={
                  readyToFund(agreement)
                    ? undefined
                    : `Waiting on ${requiredAcceptances(agreement)
                        .filter((role) => !hasAccepted(agreement, role))
                        .join(" and ")} to accept first.`
                }
                onClick={() => void live.fund(agreement)}
              >
                Fund {formatAmount(a.deposit)} {token.symbol}
              </button>
            )}
            {acting === "payer" && !readyToFund(agreement) && (
              <p className="fine-print" style={{ width: "100%" }}>
                Waiting on{" "}
                {requiredAcceptances(agreement)
                  .filter((role) => !hasAccepted(agreement, role))
                  .join(" and ")}{" "}
                to accept before this can be funded.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="milestone-list">
        {agreement.milestones.map((m, index) => {
          const state = agreement.states[index];
          const isNext = BigInt(index) === a.nextMilestone;
          return (
            <article className="milestone" key={index}>
              <div className="milestone-heading">
                <span className={`step ${state === 2 ? "done" : ""}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className="badge">
                    {state === 2
                      ? "Paid"
                      : state === 1
                        ? "Awaiting review"
                        : "Not submitted"}
                  </span>
                  <h3>{m.title}</h3>
                </div>
                <strong>
                  {formatAmount(BigInt(m.workerAmount) + BigInt(m.verifierFee))}
                </strong>
              </div>
              <p className="criteria">{m.criteria}</p>
              <div className="allocation">
                <span>
                  Worker <b>{formatAmount(BigInt(m.workerAmount))}</b>
                </span>
                <span>
                  Verifier <b>{formatAmount(BigInt(m.verifierFee))}</b>
                </span>
              </div>

              {a.funded && state !== 2 && isNext && (
                <div className="milestone-actions">
                  {acting === "worker" && state === 0 && (
                    <>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="What did you do, and how does it meet the criteria?"
                      />
                      <button
                        className="primary"
                        disabled={live.busy || notes.trim().length < 10}
                        onClick={() =>
                          void live.submit(agreement, index, notes)
                        }
                      >
                        Submit for review
                      </button>
                    </>
                  )}
                  {state === 1 &&
                    ((acting === "verifier" && agreement.verifierTag) ||
                      (acting === "payer" && !agreement.verifierTag)) && (
                      <button
                        className="primary"
                        disabled={live.busy}
                        onClick={() => void live.approve(agreement, index)}
                      >
                        Approve and pay{" "}
                        {formatAmount(
                          BigInt(m.workerAmount) + BigInt(m.verifierFee),
                        )}
                      </button>
                    )}
                  {state === 1 && acting === "worker" && (
                    <p className="fine-print">
                      Submitted. Waiting for the verifier.
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {owed > 0n && (
        <section className="action-banner">
          <div>
            <h3>
              {formatAmount(owed)} {token.symbol} is yours.
            </h3>
            <p>
              Approved work cannot be reclaimed by the payer. Withdraw whenever
              you like.
            </p>
          </div>
          <button
            className="primary"
            disabled={live.busy}
            onClick={() => void live.withdraw(agreement)}
          >
            Withdraw {formatAmount(owed)}
          </button>
        </section>
      )}

      <div className="bottom-note">
        <a
          className="file-link"
          href={explorer.address(escrow.address)}
          target="_blank"
          rel="noreferrer noopener"
        >
          Agreement #{agreement.onchainId} in contract{" "}
          {shortAddress(escrow.address)} <ArrowUpRight size={13} />
        </a>
      </div>
    </>
  );
}

function Builder({
  onCreate,
  onCancel,
  busy,
  error,
}: {
  onCreate: (draft: Draft) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
  error: string;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setMilestone = (
    index: number,
    patch: Partial<Draft["milestones"][0]>,
  ) =>
    set({
      milestones: draft.milestones.map((m, i) =>
        i === index ? { ...m, ...patch } : m,
      ),
    });

  const total = draft.milestones.reduce(
    (sum, m) => sum + (Number(m.amount) || 0) + (Number(m.fee) || 0),
    0,
  );

  return (
    <>
      <button className="text-button back" onClick={onCancel}>
        <ArrowLeft size={15} /> Cancel
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Fund a job</p>
          <h1>Agree what done means.</h1>
          <p className="muted">
            The {token.symbol} sits in the contract until the verifier confirms
            each milestone. Payment follows verified work, never the other way
            round.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      <section className="panel">
        <div className="form-stack">
          <label>
            Job
            <Input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Lekki home renovation"
            />
          </label>
          <label>
            What is included
            <Textarea
              value={draft.scope}
              onChange={(e) => set({ scope: e.target.value })}
              placeholder="Ground-floor living space. Excludes furniture."
            />
          </label>
          <div className="form-grid">
            <TagField
              label="Who is doing the work"
              value={draft.workerTag}
              onChange={(workerTag) => set({ workerTag })}
              placeholder="@bola"
            />
            <TagField
              label="Who verifies it"
              value={draft.verifierTag}
              onChange={(verifierTag) => set({ verifierTag })}
              placeholder="@ngozi"
              optional
            />
          </div>
          <label>
            Days until the agreement expires
            <Input
              value={String(draft.days)}
              onChange={(e) => set({ days: Number(e.target.value) || 1 })}
              inputMode="numeric"
            />
          </label>
        </div>
      </section>

      {draft.milestones.map((m, index) => (
        <section className="panel" key={index}>
          <p className="mono-label">Milestone {index + 1}</p>
          <div className="form-stack">
            <label>
              Title
              <Input
                value={m.title}
                onChange={(e) => setMilestone(index, { title: e.target.value })}
                placeholder="Foundation"
              />
            </label>
            <label>
              What counts as done
              <Textarea
                value={m.criteria}
                onChange={(e) =>
                  setMilestone(index, { criteria: e.target.value })
                }
                placeholder="Foundation poured, cured 72 hours, level within 5mm."
              />
            </label>
            <div className="form-grid">
              <label>
                Worker is paid ({token.symbol})
                <Input
                  value={m.amount}
                  onChange={(e) =>
                    setMilestone(index, { amount: e.target.value })
                  }
                  inputMode="decimal"
                  placeholder="1000.00"
                />
              </label>
              <label>
                Verifier&apos;s fee ({token.symbol})
                <Input
                  value={m.fee}
                  onChange={(e) => setMilestone(index, { fee: e.target.value })}
                  inputMode="decimal"
                  placeholder="30.00"
                />
              </label>
            </div>
          </div>
        </section>
      ))}

      <div className="milestone-actions">
        <button
          className="secondary"
          onClick={() =>
            set({
              milestones: [
                ...draft.milestones,
                { title: "", criteria: "", amount: "", fee: "" },
              ],
            })
          }
        >
          <Plus size={15} /> Add a milestone
        </button>
      </div>

      <section className="action-banner">
        <div>
          <h3>
            You will commit {total.toFixed(2)} {token.symbol}
          </h3>
          <p>
            Creating the agreement records it on the network. Funding moves the
            money after everyone has accepted.
          </p>
        </div>
        <button
          className="primary"
          disabled={
            busy ||
            !draft.title.trim() ||
            draft.scope.trim().length < 10 ||
            !draft.workerTag.trim() ||
            draft.milestones.some(
              (m) =>
                !m.title.trim() || m.criteria.trim().length < 10 || !m.amount,
            )
          }
          onClick={() => void onCreate(draft)}
        >
          {busy ? "Creating…" : "Create agreement"}
        </button>
      </section>
    </>
  );
}

export default LiveAgreements;
