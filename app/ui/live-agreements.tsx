"use client";
import { useEffect, useState } from "react";
import { SignInCard } from "./home";
import { HiringLinkDone } from "./hiring-link";
import { useOffers } from "../use-offers";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PILOT_TEMPLATES } from "./templates";
import { FundingReviewModal } from "./funding-review-modal";
import { ProfileCard } from "./profile-card";
import { TagField } from "./tag-field";
import { useTagGate } from "./tag-gate";
import { useWallet } from "../wallet-context";
import type { Role } from "@/lib/mera-account";
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

export function LiveAgreements({
  openId,
  onOpenChange,
  initialCreating = false,
  offer = null,
  seedDraft,
}: {
  /** A pre-filled job, e.g. from the role walkthrough. */
  seedDraft?: Draft;
  /** A taken hiring link to turn into a real job. */
  offer?: { token: string; draft: Draft; takenBy: string } | null;
  /** Set when Home sends someone straight to the builder; Home has already
      checked the @name gate. */
  initialCreating?: boolean;
  /** Lets another page (Earnings, Activity) deep-link into a specific job.
      Falls back to component-local state when the caller does not care. */
  openId?: string | null;
  onOpenChange?: (id: string | null) => void;
} = {}) {
  const w = useWallet();
  const gate = useTagGate();
  const live = useLiveAgreements();
  const [localOpen, setLocalOpen] = useState<string | null>(null);
  const open = openId !== undefined ? openId : localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [creating, setCreating] = useState(initialCreating);
  const [initialDraft, setInitialDraft] = useState<Draft | undefined>(offer?.draft ?? seedDraft);
  const offers = useOffers();
  const [profileTag, setProfileTag] = useState<{ tag: string; address?: string | null } | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [claimingTokens, setClaimingTokens] = useState(false);

  const startCreating = () => {
    if (gate.requireTag()) setCreating(true);
  };

  const handleClaimTokens = async () => {
    setClaimingTokens(true);
    try {
      if (w.requestTestTokens) {
        await w.requestTestTokens();
      } else {
        await w.sponsorTokens();
      }
    } catch (err) {
      live.setError(err instanceof Error ? err.message : "Failed to claim test tokens.");
    } finally {
      setClaimingTokens(false);
    }
  };

  if (!w.wallet) return <SignInCard />;

  const selected = live.agreements.find((a) => a.id === open) ?? null;

  // Derived rather than stored: switching role mid-draft closes the builder
  // without a state write during render.
  if (creating && w.role === "payer")
    return (
      <Builder
        initialDraft={initialDraft}
        takenBy={offer?.takenBy ?? null}
        onHiringLink={(draft) => offers.create("milestone", draft.title, draft as unknown as Record<string, unknown>)}
        busy={live.busy}
        error={live.error}
        onDismissError={() => live.setError("")}
        onCancel={() => {
          setCreating(false);
          setInitialDraft(undefined);
        }}
        onCreate={async (draft) => {
          const id = await live.create(draft);
          if (id !== null) {
            if (offer) await offers.update(offer.token, "created", String(id)).catch(() => undefined);
            setCreating(false);
            setInitialDraft(undefined);
          }
        }}
      />
    );

  if (selected)
    return (
      <Detail
        agreement={selected}
        live={live}
        onBack={() => setOpen(null)}
        onDuplicate={(draft) => {
          setInitialDraft(draft);
          setCreating(true);
        }}
      />
    );

  const reserved = live.agreements.reduce((s, a) => s + a.chain.reserved, 0n);
  const earned = live.agreements.reduce(
    (s, a) => s + a.chain.workerEarned + a.chain.verifierEarned,
    0n,
  );
  const awaiting = live.agreements.reduce(
    (s, a) => s + a.states.filter((state) => state === 1).length,
    0,
  );

  const bucket = (a: LiveAgreement): "awaiting" | "active" | "complete" => {
    if (!a.chain.funded) return "awaiting";
    if (a.chain.reserved === 0n || a.chain.cancelled) return "complete";
    return "active";
  };

  const visible = live.agreements.filter(
    (a) =>
      (filter === "all" || bucket(a) === filter) &&
      `${a.title} ${a.workerTag ?? ""} ${a.verifierTag ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PAY WITH CONFIDENCE</p>
          <h1>
            Your agreements<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            {token.symbol} is held by the contract until the agreed verifier
            confirms the work. Nobody, including us, can move it another way.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            className="secondary"
            disabled={claimingTokens}
            onClick={handleClaimTokens}
          >
            {claimingTokens ? "Claiming..." : "Claim Test AUSD"}
          </button>
          {(!w.demoRoles || w.role === "payer") && (
            <button className="primary" onClick={startCreating}>
              <Plus size={16} /> New agreement
            </button>
          )}
        </div>
      </div>

      <div className="notice" style={{ marginTop: 0, marginBottom: "20px" }}>
        <ShieldCheck size={18} />
        <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
          <strong>How Escrow Protection Works:</strong>
          <span style={{ display: "block", marginTop: "4px" }}>
            • <strong>Payer</strong>: Deposits money into the vault up front so payment is guaranteed.<br />
            • <strong>Worker</strong>: Completes milestones and uploads photo/document proof.<br />
            • <strong>Verifier</strong>: Inspects work and approves funds for release.
          </span>
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

      <div className="metrics">
        <section className="metric featured">
          <div className="section-title">
            <span>Reserved for work</span>
            <ShieldCheck size={20} />
          </div>
          <strong>{formatAmount(reserved)}</strong>
          <small>
            Across{" "}
            {live.agreements.filter((a) => a.chain.reserved > 0n).length}{" "}
            funded agreements
          </small>
        </section>
        <section className="metric">
          <span>Earned by your team</span>
          <strong>{formatAmount(earned)}</strong>
          <small>Protected once work is verified</small>
        </section>
        <section className="metric">
          <span>Awaiting verification</span>
          <strong>{String(awaiting).padStart(2, "0")}</strong>
          <small>
            {awaiting === 1 ? "One milestone" : `${awaiting} milestones`}{" "}
            ready for review
          </small>
        </section>
      </div>

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
            {w.demoRoles && w.role !== "payer"
              ? "A job appears here once someone names this role's account in it."
              : `Start one, or wait for someone to name @${w.tags.payer?.tag ?? "your tag"} in a job. They share a link; you sign in with your passkey and accept.`}
          </p>
          {(!w.demoRoles || w.role === "payer") && (
            <button className="secondary" onClick={startCreating}>
              New agreement <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="list-toolbar">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList variant="line">
                <TabsTrigger value="all">All agreements</TabsTrigger>
                <TabsTrigger value="awaiting">Awaiting funding</TabsTrigger>
                <TabsTrigger value="active">In progress</TabsTrigger>
                <TabsTrigger value="complete">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="search">
              <Search size={16} />
              <Input
                aria-label="Search agreements"
                placeholder="Search agreements…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state">
              <FolderOpen size={34} />
              <h2>No matching agreements</h2>
              <p>Try another name or filter.</p>
            </div>
          ) : (
            <div className="agreement-grid">
              {visible.map((a) => {
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
                        {a.workerTag
                          ? `@${a.workerTag}`
                          : shortAddress(a.worker)}
                        {a.verifierTag
                          ? ` · verified by @${a.verifierTag}`
                          : ""}
                      </p>
                    </div>
                    <div
                      className="tile-progress"
                      role="img"
                      aria-label={`${done} of ${a.milestones.length} milestones complete`}
                    >
                      <span
                        style={{
                          width: `${(done / a.milestones.length) * 100}%`,
                        }}
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
        </>
      )}

      <div className="bottom-note">
        <ShieldCheck size={16} />
        Held by contract {shortAddress(escrow.address)} · every figure read from
        the network
      </div>

      {profileTag && (
        <ProfileCard
          tag={profileTag.tag}
          address={profileTag.address}
          onClose={() => setProfileTag(null)}
        />
      )}
    </>
  );
}

function status(a: LiveAgreement): string {
  if (a.chain.cancelled) return "Cancelled";
  if (!a.chain.funded) {
    return readyToFund(a) ? "Ready to fund" : "Awaiting acceptances";
  }
  if (a.chain.reserved === 0n) return "Complete";
  if (a.states.some((s) => s === 1)) return "Awaiting review";
  return "In progress";
}

function Detail({
  agreement,
  live,
  onBack,
  onDuplicate,
}: {
  agreement: LiveAgreement;
  live: ReturnType<typeof useLiveAgreements>;
  onBack: () => void;
  onDuplicate: (draft: Draft) => void;
}) {
  const w = useWallet();
  const [notes, setNotes] = useState("");
  const [reviewingFunding, setReviewingFunding] = useState(false);
  const [claimingInDetail, setClaimingInDetail] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const acting = roleOf(agreement, w.address);
  const a = agreement.chain;

  const userAusd = w.ausdBalance ?? w.balances.payer ?? w.balances[w.role] ?? 0n;
  const isInsufficientFunds =
    acting === "payer" &&
    !a.funded &&
    readyToFund(agreement) &&
    userAusd < a.deposit;

  const required = requiredAcceptances(agreement);
  const acceptedRoles = required.filter((r) => hasAccepted(agreement, r));
  const pendingRoles = required.filter((r) => !hasAccepted(agreement, r));

  const formatRoleTag = (r: Role) => {
    if (r === "worker")
      return agreement.workerTag ? `@${agreement.workerTag}` : "@worker";
    if (r === "verifier")
      return agreement.verifierTag ? `@${agreement.verifierTag}` : "@verifier";
    return "@payer";
  };

  const acceptedText = acceptedRoles.length
    ? acceptedRoles.map(formatRoleTag).join(", ")
    : "nobody";
  const pendingText = pendingRoles.map(formatRoleTag).join(" and ");

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
        <div className="flex gap-2">
          <button
            className="secondary"
            onClick={() => {
              onDuplicate({
                title: `${agreement.title} (Copy)`,
                scope: agreement.scope,
                workerTag: agreement.workerTag ?? "",
                verifierTag: agreement.verifierTag ?? "",
                days: 14,
                milestones: agreement.milestones.map((m) => ({
                  title: m.title,
                  criteria: m.criteria,
                  amount: formatAmount(BigInt(m.workerAmount)),
                  fee: formatAmount(BigInt(m.verifierFee)),
                })),
              });
            }}
          >
            <Plus size={15} /> Duplicate as Draft
          </button>
          <ShareLinkButton agreement={agreement} />
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

      {isInsufficientFunds && (
        <div
          role="alert"
          className="error-banner"
          style={{
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            Insufficient AUSD balance. You have {formatAmount(userAusd)} but
            need {formatAmount(a.deposit)} to fund this job.
          </div>
          <button
            className="secondary text-xs"
            disabled={claimingInDetail}
            onClick={async () => {
              setClaimingInDetail(true);
              try {
                if (w.requestTestTokens) await w.requestTestTokens();
                else await w.sponsorTokens();
              } catch (err) {
                live.setError(
                  err instanceof Error
                    ? err.message
                    : "Failed to claim test tokens.",
                );
              } finally {
                setClaimingInDetail(false);
              }
            }}
          >
            {claimingInDetail ? "Claiming..." : "Claim Test AUSD"}
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
                : !readyToFund(agreement)
                  ? "Waiting on required acceptances."
                  : "Ready for funding."}
            </h3>
            <p>
              {!readyToFund(agreement) ? (
                <>
                  Accepted so far: {acceptedText}. Waiting for {pendingText} to
                  accept terms before funding can proceed.
                </>
              ) : (
                <>
                  All required terms accepted. Funding moves{" "}
                  {formatAmount(a.deposit)} {token.symbol} into the contract.
                </>
              )}
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
                disabled={
                  live.busy || !readyToFund(agreement) || userAusd < a.deposit
                }
                title={
                  !readyToFund(agreement)
                    ? `Waiting for ${pendingText} to accept terms before funding can proceed.`
                    : userAusd < a.deposit
                      ? `Insufficient AUSD balance (${formatAmount(userAusd)} available, ${formatAmount(a.deposit)} needed).`
                      : undefined
                }
                onClick={() => void live.fund(agreement)}
              >
                Fund {formatAmount(a.deposit)} {token.symbol}
              </button>
            )}
            {acting === "payer" && !readyToFund(agreement) && (
              <p className="fine-print" style={{ width: "100%" }}>
                Waiting on {pendingText} to accept before this can be funded.
              </p>
            )}
            {acting === "payer" &&
              readyToFund(agreement) &&
              userAusd < a.deposit && (
                <p
                  className="fine-print"
                  style={{ width: "100%", color: "var(--m-amber-text, #b45309)" }}
                >
                  Insufficient AUSD balance ({formatAmount(userAusd)} available,{" "}
                  {formatAmount(a.deposit)} needed).
                </p>
              )}
          </div>
        </section>
      )}

      {/* Cancellation and Refund Controls */}
      {a.funded && (
        <section className="panel mb-4 p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">
                {a.cancelled
                  ? "Agreement Cancelled"
                  : "Mutual Cancellation & Refund"}
              </h3>
              <p className="text-xs text-muted">
                {a.cancelled
                  ? "The agreement was cancelled by mutual consent. Reserved funds can be refunded to the payer."
                  : "Both parties must consent to cancel an active agreement. Reserved funds return to the payer."}
              </p>
            </div>
            <div className="flex gap-2">
              {acting && !a.cancelled && (
                <button
                  className="secondary text-xs"
                  disabled={live.busy}
                  onClick={() => void live.consentCancellation(agreement)}
                >
                  Vote to Cancel
                </button>
              )}
              {acting === "payer" && (a.cancelled || now / 1000 >= Number(a.expiry)) && a.reserved > 0n && (
                <button
                  className="primary text-xs"
                  disabled={live.busy}
                  onClick={() => void live.refund(agreement)}
                >
                  Claim Refund ({formatAmount(a.reserved)} {token.symbol})
                </button>
              )}
            </div>
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
  initialDraft,
  takenBy = null,
  onHiringLink,
  onCreate,
  onCancel,
  busy,
  error,
  onDismissError,
}: {
  initialDraft?: Draft;
  /** Set when creating the job for someone who took a hiring link. */
  takenBy?: string | null;
  /** Saves the job as a hiring link instead; returns the link's token. */
  onHiringLink?: (draft: Draft) => Promise<string>;
  onCreate: (draft: Draft) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
  error: string;
  onDismissError: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initialDraft ?? emptyDraft);
  // Set only once someone tries to submit an incomplete form: highlighting
  // every required field red before it has even been touched would just be
  // noise, not help.
  const [showErrors, setShowErrors] = useState(false);
  const [workerFound, setWorkerFound] = useState(false);
  const [verifierFound, setVerifierFound] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
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
  const removeMilestone = (index: number) =>
    set({ milestones: draft.milestones.filter((_, i) => i !== index) });

  const total = draft.milestones.reduce(
    (sum, m) => sum + (Number(m.amount) || 0) + (Number(m.fee) || 0),
    0,
  );

  const titleValid = draft.title.trim().length > 0;
  const scopeValid = draft.scope.trim().length >= 10;
  // No worker yet means a hiring link, not an invalid form.
  const hiring = !takenBy && !draft.workerTag.trim() && !!onHiringLink;
  const workerValid = hiring || !!takenBy || workerFound;
  const verifierValid =
    !draft.verifierTag.trim() || verifierFound;
  const milestonesValid = draft.milestones.map((m) => ({
    title: m.title.trim().length > 0,
    criteria: m.criteria.trim().length >= 10,
    amount: Boolean(m.amount),
  }));
  const formValid =
    titleValid &&
    scopeValid &&
    workerValid &&
    verifierValid &&
    milestonesValid.every((v) => v.title && v.criteria && v.amount);
  const invalid = (ok: boolean) => showErrors && !ok;

  if (linkToken) return <HiringLinkDone token={linkToken} onDone={onCancel} />;

  return (
    <>
      <button className="text-button back" onClick={onCancel}>
        <ArrowLeft size={15} /> Cancel
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">New milestone job</p>
          <h1>Split the project into stages.</h1>
          <p className="muted">
            The whole amount is locked when you fund. Each stage is paid when you,
            or a reviewer you both trust, approve it. Anything never earned comes
            back to you.
          </p>
        </div>
      </div>

      {(error || linkError) && (
        <div role="alert" className="error-banner">
          {linkError || error}
          <button className="text-button" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      )}

      <section className="panel" style={{ marginTop: 0, marginBottom: "20px" }}>
        <p className="eyebrow" style={{ marginBottom: "12px" }}>Start from a template</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {PILOT_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              className="secondary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
              onClick={() => {
                set({
                  title: tmpl.name,
                  scope: tmpl.description,
                  days: tmpl.days,
                  milestones: tmpl.milestones.map((m) => ({ ...m })),
                });
              }}
            >
              + {tmpl.name}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="form-stack">
          <label>
            Job
            <Input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Rebuild our online store"
              aria-invalid={invalid(titleValid)}
            />
            {invalid(titleValid) && (
              <p className="field-error">A job title is required.</p>
            )}
          </label>
          <label>
            What is included
            <Textarea
              value={draft.scope}
              onChange={(e) => set({ scope: e.target.value })}
              placeholder="Shopify storefront with product pages and checkout. Excludes copywriting."
              aria-invalid={invalid(scopeValid)}
            />
            {invalid(scopeValid) && (
              <p className="field-error">
                Describe the scope in at least 10 characters.
              </p>
            )}
          </label>
          {takenBy && (
            <p className="taken-by"><UserCheck size={17} aria-hidden /> <span><b>{takenBy}</b> took your hiring link and will do the work.</span></p>
          )}
          <div className="form-grid">
            {!takenBy && <TagField
              label="Who is doing the work"
              value={draft.workerTag}
              onChange={(workerTag) => set({ workerTag })}
              onResolved={(found) => setWorkerFound(Boolean(found))}
              placeholder="@bola"
              invalid={invalid(workerValid)}
              helperText="Their @name. Don't know who yet? Leave it empty to create a hiring link."
            />}
            <TagField
              label="Who verifies it"
              value={draft.verifierTag}
              onChange={(verifierTag) => set({ verifierTag })}
              onResolved={(found) => setVerifierFound(Boolean(found))}
              placeholder="@ngozi"
              optional
              invalid={invalid(verifierValid)}
              helperText="Optional. Someone you both trust to approve each stage, like a senior developer. Leave empty to approve stages yourself."
            />
          </div>
          <label>
            Days until the job expires
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
          <div className="section-title" style={{ marginBottom: 12 }}>
            <p className="mono-label">Milestone {index + 1}</p>
            {draft.milestones.length > 1 && (
              <button
                className="text-button"
                onClick={() => removeMilestone(index)}
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
          <div className="form-stack">
            <label>
              Title
              <Input
                value={m.title}
                onChange={(e) => setMilestone(index, { title: e.target.value })}
                placeholder="Wireframes"
                aria-invalid={invalid(milestonesValid[index].title)}
              />
              {invalid(milestonesValid[index].title) && (
                <p className="field-error">A milestone title is required.</p>
              )}
            </label>
            <label>
              What counts as done
              <Textarea
                value={m.criteria}
                onChange={(e) =>
                  setMilestone(index, { criteria: e.target.value })
                }
                placeholder="Wireframes for every agreed page, shared as a Figma link."
                aria-invalid={invalid(milestonesValid[index].criteria)}
              />
              {invalid(milestonesValid[index].criteria) && (
                <p className="field-error">
                  Describe what counts as done in at least 10 characters.
                </p>
              )}
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
                  aria-invalid={invalid(milestonesValid[index].amount)}
                />
                {invalid(milestonesValid[index].amount) && (
                  <p className="field-error">An amount is required.</p>
                )}
              </label>
              <label>
                Reviewer&apos;s fee ({token.symbol})
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
            {hiring ? "Share it first, fund it later." : `You will commit ${total.toFixed(2)} ${token.symbol}`}
          </h3>
          <p>
            {showErrors && !formValid
              ? "Fill in the highlighted fields first."
              : hiring
                ? "You'll get a link to send. Once someone takes the job, you create it for them and fund it."
                : "Creating the job records it on Monad. You fund it after everyone has accepted."}
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || linking}
          onClick={async () => {
            if (!formValid) {
              setShowErrors(true);
              return;
            }
            if (hiring && onHiringLink) {
              setLinking(true);
              setLinkError("");
              try {
                setLinkToken(await onHiringLink(draft));
              } catch (cause) {
                setLinkError(cause instanceof Error ? cause.message : "Could not create the hiring link.");
              } finally {
                setLinking(false);
              }
              return;
            }
            void onCreate(draft);
          }}
        >
          {hiring ? (linking ? "Creating link…" : "Create hiring link") : busy ? "Creating…" : "Create job"}
        </button>
      </section>
    </>
  );
}

function ShareLinkButton({ agreement }: { agreement: LiveAgreement }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId: agreement.id,
          role: "worker",
          days: 7,
        }),
      });
      let url = `${window.location.origin}/app?job=${encodeURIComponent(agreement.id)}`;
      if (res.ok) {
        const data = (await res.json()) as { token?: string };
        if (data.token) {
          url = `${window.location.origin}/app?invite=${encodeURIComponent(data.token)}`;
        }
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const fallbackUrl = `${window.location.origin}/app?job=${encodeURIComponent(agreement.id)}`;
      void navigator.clipboard.writeText(fallbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="secondary" onClick={handleShare} disabled={loading}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Invite link copied!" : loading ? "Generating..." : "Share invite"}
    </button>
  );
}

function ActionInboxBanner({
  agreements,
  address,
  onOpen,
}: {
  agreements: LiveAgreement[];
  address: string | null;
  onOpen: (id: string) => void;
}) {
  if (!address) return null;
  const actions: { id: string; title: string; action: string; badge: string }[] = [];

  for (const a of agreements) {
    const role = roleOf(a, address);
    if (!role) continue;

    if (!hasAccepted(a, role) && !a.chain.cancelled) {
      actions.push({
        id: a.id,
        title: a.title,
        action: `Accept terms as ${role}`,
        badge: "Acceptance Required",
      });
    } else if (role === "payer" && readyToFund(a) && !a.chain.funded) {
      actions.push({
        id: a.id,
        title: a.title,
        action: "Fund agreement deposit",
        badge: "Ready to Fund",
      });
    } else if (a.chain.funded && !a.chain.cancelled && a.chain.reserved > 0n) {
      const pendingReview = a.states.findIndex((s) => s === 1);
      if (pendingReview !== -1) {
        const milestone = a.milestones[pendingReview];
        // The contract makes every milestone reviewer-approved once a
        // reviewer is named, whatever its fee (see create in use-live-agreements).
        const isApprover = a.chain.verifier !== `0x${"0".repeat(40)}` ? role === "verifier" : role === "payer";
        if (isApprover) {
          actions.push({
            id: a.id,
            title: a.title,
            action: `Review submission for "${milestone.title}"`,
            badge: "Review Needed",
          });
        }
      }
    }
  }

  if (!actions.length) return null;

  return (
    <div className="panel" style={{ borderLeft: "2px solid var(--m-purple)", marginTop: 0, marginBottom: "20px", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldCheck size={16} /> Action Required Inbox ({actions.length})
        </h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {actions.map((act, i) => (
          <div
            key={`${act.id}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: "var(--m-surface)",
              border: "1px solid var(--m-hairline)",
              fontSize: "13px",
            }}
          >
            <div>
              <strong style={{ color: "var(--m-ink)" }}>{act.title}</strong> —{" "}
              <span className="muted">{act.action}</span>
            </div>
            <button
              className="primary"
              style={{ fontSize: "12px", padding: "4px 12px" }}
              onClick={() => onOpen(act.id)}
            >
              Open <ArrowUpRight size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveAgreements;
