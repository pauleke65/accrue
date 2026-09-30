"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Code2, FileText, GitPullRequest, Link2, ScanSearch, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { token } from "@/lib/chain";
import { deliverableKind, parseDigitalPolicy, type DeliverableKind, type DigitalPolicy } from "@/lib/digital-work-policy";
import type { DigitalConfig, DigitalDraft } from "../use-digital-work";
import { HiringLinkDone } from "./hiring-link";
import { clearDraft, loadDraft, saveDraft } from "./draft-store";
import { ReviewerSuggestions } from "./reviewer-suggestions";
import { useWallet } from "../wallet-context";

/**
 * Writing a proof-checked job in plain words.
 *
 * The policy is what gets hashed on chain, so the form keeps every
 * deliverable type's fields separately and builds the policy only on submit.
 * Each type says, in a sentence, exactly what Proof Engine will check.
 */

type Form = {
  kind: DeliverableKind;
  title: string;
  brief: string;
  requiredText: string;
  repository: string;
  endpointPath: string;
  expectedStatus: number;
  expectedJsonKey: string;
  expectedJsonValue: string;
  worker: string;
  reviewerB: string;
  reviewerC: string;
  reward: string;
  verifierFees: string;
  deliveryDays: number;
  reviewDays: number;
};

const blank: Form = {
  kind: "webpage",
  title: "",
  brief: "",
  requiredText: "",
  repository: "",
  endpointPath: "/api/health",
  expectedStatus: 200,
  expectedJsonKey: "ok",
  expectedJsonValue: "true",
  worker: "",
  reviewerB: "",
  reviewerC: "",
  reward: "100.00",
  verifierFees: "6.00",
  deliveryDays: 3,
  reviewDays: 2,
};

const kinds: { id: DeliverableKind; label: string; icon: typeof FileText; hint: string }[] = [
  { id: "webpage", label: "A live web page", icon: FileText, hint: "Landing pages, docs, published articles. The page must load and include text you choose." },
  { id: "pull_request", label: "Merged code", icon: GitPullRequest, hint: "A GitHub pull request merged into your repository. Your merge is the sign-off." },
  { id: "api", label: "A working API", icon: Code2, hint: "A deployed endpoint that must answer with specific data." },
];

function fromDraft(draft: DigitalDraft): Form {
  const p = draft.policy as Record<string, unknown>;
  return {
    ...blank,
    kind: deliverableKind(draft.policy),
    title: String(p.title ?? ""),
    brief: String(p.brief ?? ""),
    requiredText: String(p.requiredText ?? ""),
    repository: String(p.repository ?? ""),
    endpointPath: String(p.endpointPath ?? blank.endpointPath),
    expectedStatus: Number(p.expectedStatus ?? 200),
    expectedJsonKey: String(p.expectedJsonKey ?? blank.expectedJsonKey),
    expectedJsonValue: String(p.expectedJsonValue ?? blank.expectedJsonValue),
    worker: draft.worker,
    reviewerB: draft.reviewerB,
    reviewerC: draft.reviewerC,
    reward: draft.reward,
    verifierFees: draft.verifierFees,
    deliveryDays: Math.max(1, Math.round(draft.deliveryHours / 24)),
    reviewDays: Math.max(1, Math.round(draft.reviewHours / 24)),
  };
}

function toPolicy(form: Form): DigitalPolicy {
  const common = { title: form.title, brief: form.brief, passThreshold: 0.9 as const, failThreshold: 0.1 as const };
  const raw = form.kind === "webpage" ? { type: "webpage", ...common, requiredText: form.requiredText }
    : form.kind === "pull_request" ? { type: "pull_request", ...common, repository: form.repository.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "") }
    : { ...common, endpointPath: form.endpointPath, expectedStatus: form.expectedStatus, expectedJsonKey: form.expectedJsonKey, expectedJsonValue: form.expectedJsonValue };
  return parseDigitalPolicy(raw);
}

function toDraft(form: Form): DigitalDraft {
  return {
    policy: toPolicy(form),
    worker: form.worker.trim(),
    reviewerB: form.reviewerB.trim(),
    reviewerC: form.reviewerC.trim(),
    reward: form.reward,
    verifierFees: form.verifierFees,
    deliveryHours: form.deliveryDays * 24,
    reviewHours: form.reviewDays * 24,
  };
}

/** What Proof Engine will check, in one sentence. */
function checkSentence(form: Form): string {
  if (form.kind === "webpage")
    return `The page the worker submits must load over HTTPS and contain "${form.requiredText || "…"}".`;
  if (form.kind === "pull_request")
    return `The pull request must be merged into ${form.repository || "owner/repository"} on GitHub.`;
  return `A GET to ${form.endpointPath || "/…"} on the worker's deployment must answer ${form.expectedStatus} with "${form.expectedJsonKey}" equal to "${form.expectedJsonValue}", and the commit must be public.`;
}

export function DigitalWorkBuilder({
  config, busy, error, onBack, onCreate, onHiringLink, initialDraft, takenBy,
}: {
  config: DigitalConfig | null;
  busy: boolean;
  error: string;
  onBack: () => void;
  onCreate: (draft: DigitalDraft) => Promise<void>;
  /** Saves the job as a hiring link instead; returns the link's token. */
  onHiringLink?: (title: string, draft: DigitalDraft, listed: boolean) => Promise<string>;
  initialDraft?: DigitalDraft;
  /** Set when creating the job for someone who took a hiring link. */
  takenBy?: string | null;
}) {
  // A pre-filled job (from a hiring link) wins; otherwise pick up where this
  // tab left off, e.g. after the signing session timed out.
  const [form, setForm] = useState<Form>(() => initialDraft ? fromDraft(initialDraft) : { ...blank, ...(loadDraft<Form>("proof") ?? {}) });
  useEffect(() => { if (!initialDraft) saveDraft("proof", form); }, [form, initialDraft]);
  const [problem, setProblem] = useState("");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [listed, setListed] = useState(true);
  const wallet = useWallet();
  const me = wallet.tags[wallet.role]?.tag ?? wallet.address ?? "";
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const ready = !!config?.contractAddress && !!config?.jevAddress;
  const total = (Number(form.reward) || 0) + (Number(form.verifierFees) || 0);
  const hiring = !form.worker.trim() && !takenBy;

  const build = (): DigitalDraft | null => {
    try {
      setProblem("");
      return toDraft(form);
    } catch (cause) {
      const issue = (cause as { issues?: { message: string; path: (string | number)[] }[] }).issues?.[0];
      setProblem(issue ? `${issue.path.join(" ") || "Form"}: ${issue.message}` : "Check the highlighted details.");
      return null;
    }
  };

  const submit = async () => {
    const draft = build();
    if (!draft) return;
    if (!draft.reviewerB || !draft.reviewerC) return setProblem("Name both reviewers before continuing.");
    if (hiring) {
      if (!onHiringLink) return setProblem("Name the worker who will do this job.");
      setLinking(true);
      try {
        setLinkToken(await onHiringLink(form.title, draft, listed));
        clearDraft("proof");
      } catch (cause) {
        setProblem(cause instanceof Error ? cause.message : "Could not create the hiring link.");
      } finally {
        setLinking(false);
      }
      return;
    }
    await onCreate(draft);
  };

  if (linkToken) return <HiringLinkDone token={linkToken} onDone={onBack} />;

  return (
    <>
      <button className="text-button back" onClick={onBack}><ArrowLeft size={15} aria-hidden /> Jobs</button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">New proof-checked job</p>
          <h1>Describe the result you are paying for.</h1>
          <p className="muted">
            Proof Engine checks the evidence automatically. Two people you trust confirm anything it is
            unsure of. The worker is paid when two of the three pass it.
          </p>
        </div>
      </div>
      {(error || problem) && <div role="alert" className="error-banner">{problem || error}</div>}

      <form className="dw-builder" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <section className="panel dw-form-section">
          <div className="dw-section-head"><span>01</span><div><h2>What are you paying for?</h2><p>Pick the kind of result. It decides what Proof Engine can check.</p></div></div>
          <div className="kind-picker" role="radiogroup" aria-label="Kind of deliverable">
            {kinds.map(({ id, label, icon: Icon, hint }) => (
              <button type="button" role="radio" aria-checked={form.kind === id} key={id} className="kind-option" onClick={() => set({ kind: id })}>
                <Icon size={20} aria-hidden />
                <b>{label}</b>
                <span>{hint}</span>
              </button>
            ))}
          </div>
          <div className="form-stack">
            <label>Job title<Input value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder={form.kind === "webpage" ? "Write and publish our pricing page" : form.kind === "pull_request" ? "Fix the mobile checkout bug" : "Build a live exchange-rate endpoint"} required /></label>
            <label>Describe the work<Textarea value={form.brief} maxLength={2000} onChange={(e) => set({ brief: e.target.value })} placeholder="What should be delivered, and what would make you happy with it? Reviewers read this." required /><small className="field-hint">At least 15 characters. Proof Engine&apos;s AI and the reviewers judge the evidence against this.</small></label>

            {form.kind === "webpage" && (
              <label>Text the live page must contain<Input value={form.requiredText} maxLength={200} onChange={(e) => set({ requiredText: e.target.value })} placeholder="Plans start at $9 a month" required /><small className="field-hint">A phrase that only appears once the work is really done, like a headline or price.</small></label>
            )}
            {form.kind === "pull_request" && (
              <label>Your GitHub repository<Input value={form.repository} onChange={(e) => set({ repository: e.target.value })} placeholder="acme/shop" required /><small className="field-hint">Owner and name, as in github.com/<b>acme/shop</b>. The repository must be public, and the pull request must be merged into it.</small></label>
            )}
            {form.kind === "api" && (
              <>
                <div className="form-grid">
                  <label>Endpoint path<Input value={form.endpointPath} onChange={(e) => set({ endpointPath: e.target.value })} placeholder="/api/rates" required /><small className="field-hint">The path Proof Engine calls on the worker&apos;s deployment.</small></label>
                  <label>Expected status<Input type="number" min={200} max={299} value={form.expectedStatus} onChange={(e) => set({ expectedStatus: Number(e.target.value) })} required /><small className="field-hint">200 means &ldquo;OK&rdquo;.</small></label>
                </div>
                <div className="form-grid">
                  <label>JSON field to check<Input value={form.expectedJsonKey} onChange={(e) => set({ expectedJsonKey: e.target.value })} placeholder="base" required /></label>
                  <label>Must equal<Input value={form.expectedJsonValue} onChange={(e) => set({ expectedJsonValue: e.target.value })} placeholder="USD" required /></label>
                </div>
              </>
            )}
            <p className="check-sentence"><ScanSearch size={16} aria-hidden /> {checkSentence(form)}</p>
          </div>
        </section>

        <section className="panel dw-form-section">
          <div className="dw-section-head"><span>02</span><div><h2>Who does it?</h2><p>The worker accepts these exact terms before you fund anything.</p></div></div>
          {takenBy ? (
            <p className="taken-by"><UserCheck size={17} aria-hidden /> <span><b>{takenBy}</b> took your hiring link. They will be asked to accept once you create the job. {takenBy.startsWith("@") && <a href={`/u/${takenBy.slice(1)}`} target="_blank" rel="noreferrer noopener">See their verified work</a>}</span></p>
          ) : (
            <div className="form-stack">
              <label>Worker&apos;s @name<Input value={form.worker} onChange={(e) => set({ worker: e.target.value })} placeholder="@kofi" /><small className="field-hint">Don&apos;t know who yet? Leave this empty and you&apos;ll get a hiring link to share instead.</small></label>
            </div>
          )}
        </section>

        <section className="panel dw-form-section">
          <div className="dw-section-head"><span>03</span><div><h2>Who confirms it?</h2><p>Proof Engine plus two people. Two of the three pass votes release payment.</p></div></div>
          <div className="form-stack">
            <div className="dw-engine-identity"><span className="dw-engine-icon"><ScanSearch size={24} strokeWidth={1.7} aria-hidden /></span><div><small>REVIEWER ONE · AUTOMATIC</small><strong>Accrue Proof Engine</strong><span>Runs the check above, then asks an AI model whether the evidence meets your description. It only votes when it is confident; otherwise it steps aside.</span><em>{ready ? (config?.modelReady ? "Ready" : "Checks ready · AI not connected on this deployment") : "Not configured on this deployment"}</em></div></div>
            <div className="form-grid">
              <label>Reviewer two<Input value={form.reviewerB} onChange={(e) => set({ reviewerB: e.target.value })} placeholder="@amaka" required /></label>
              <label>Reviewer three<Input value={form.reviewerC} onChange={(e) => set({ reviewerC: e.target.value })} placeholder="@tunde" required /></label>
            </div>
            <ReviewerSuggestions
              exclude={[me, form.worker, form.reviewerB, form.reviewerC, takenBy ?? ""]}
              onPick={(tag) => set(form.reviewerB.trim() ? { reviewerC: tag } : { reviewerB: tag })}
            />
            <p className="fine-print">Pick people you and the worker would both trust to judge the work, like a senior developer or an editor. They can&apos;t be you or the worker, and each is paid for voting.</p>
          </div>
        </section>

        <section className="panel dw-form-section">
          <div className="dw-section-head"><span>04</span><div><h2>Pay and deadlines</h2><p>Nothing moves until the worker accepts and you fund.</p></div></div>
          <div className="form-stack">
            <div className="form-grid">
              <label>Worker is paid ({token.symbol})<Input value={form.reward} onChange={(e) => set({ reward: e.target.value })} inputMode="decimal" required /></label>
              <label>Review fees ({token.symbol})<Input value={form.verifierFees} onChange={(e) => set({ verifierFees: e.target.value })} inputMode="decimal" required /><small className="field-hint">Split three ways. Each reviewer who votes earns a third; the rest comes back to you.</small></label>
            </div>
            <div className="form-grid">
              <label>Days to deliver<Input type="number" min={1} max={30} value={form.deliveryDays} onChange={(e) => set({ deliveryDays: Math.max(1, Number(e.target.value) || 1) })} required /></label>
              <label>Days to review after delivery<Input type="number" min={1} max={7} value={form.reviewDays} onChange={(e) => set({ reviewDays: Math.max(1, Number(e.target.value) || 1) })} required /><small className="field-hint">If nobody approves in time, you can take the money back.</small></label>
            </div>
          </div>
        </section>

        {hiring && (
          <label className="check-row">
            <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} />
            <span><b>List it on the public job board</b> so people looking for work can find it. Untick to share the link privately.</span>
          </label>
        )}

        <div className="action-banner">
          <div>
            <h3>{hiring ? "Share it first, fund it later." : `You will deposit ${total.toFixed(2)} ${token.symbol}.`}</h3>
            <p>{hiring
              ? "You'll get a link to send. Once someone takes the job, you create it for them and fund it."
              : "Creating the job records these terms on Monad. You fund it after the worker accepts."}</p>
          </div>
          <button className="primary" type="submit" disabled={busy || linking || !ready}>
            {hiring ? (linking ? "Creating link…" : <><Link2 size={16} aria-hidden /> Create hiring link</>) : busy ? "Creating…" : "Create job"}
          </button>
        </div>
      </form>
    </>
  );
}
