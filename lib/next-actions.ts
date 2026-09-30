/**
 * What each job needs next, and from whom.
 *
 * The dashboard's "Needs you" list comes from here. Both escrow contracts
 * enforce their own rules; this only mirrors them closely enough to tell a
 * person which button is theirs to press. Inputs are plain shapes so the
 * logic runs under node --test without the app's path aliases.
 */

export type JobKind = "proof" | "milestone";

export type NextAction = {
  key: string;
  kind: JobKind;
  jobId: string;
  title: string;
  /** Imperative, shown as the row's headline: "Fund the escrow". */
  action: string;
  /** One line of context: why this is next. */
  detail: string;
  /** "you" means this person can act now; "waiting" means someone else must. */
  owner: "you" | "waiting";
};

/** Mirrors DigitalWorkStatus in lib/digital-work-chain.ts. */
export const ProofStatus = { draft: 0, funded: 1, submitted: 2, needsChanges: 3, paid: 4, refunded: 5 } as const;

export type ProofJobInput = {
  id: string;
  title: string;
  payer: string;
  worker: string;
  verifiers: readonly string[];
  status: number;
  workerAccepted: boolean;
  deliveryDeadline: bigint;
  reviewDeadline: bigint;
  /** Whether this person already voted on the current version; null if not a verifier or unknown. */
  votedCurrentVersion: boolean | null;
  /** Contract rules: 2 adds pay-on-silence and cancellation. Defaults to 1. */
  rules?: number;
  /** Fail votes on the current version. */
  failVotes?: number;
  /** Version 2: bit 1 the client, bit 2 the worker has agreed to cancel. */
  cancelConsents?: number;
};

export type MilestoneJobInput = {
  id: string;
  title: string;
  payer: string;
  worker: string;
  /** Zero address when the client approves every milestone. */
  verifier: string;
  milestones: { title: string; external: boolean }[];
  /** 0 pending, 1 submitted, 2 earned; mirrors MilestoneState. */
  states: number[];
  /** Contract rules: 2 adds the review window and pay-on-silence. Defaults to 1. */
  rules?: number;
  /** Version 2: when the current milestone was submitted, in seconds (0 if unknown). */
  submittedAt?: bigint;
  acceptances: number;
  funded: boolean;
  cancelled: boolean;
  expiry: bigint;
  reserved: bigint;
  nextMilestone: number;
  workerEarned: bigint;
  workerWithdrawn: bigint;
  verifierEarned: bigint;
  verifierWithdrawn: bigint;
};

const ZERO = "0x0000000000000000000000000000000000000000";
/** Mirrors REVIEW_WINDOW in AccrueEscrow version 2. */
export const REVIEW_WINDOW = 5n * 24n * 60n * 60n;
const same = (a: string, b: string | null) => !!b && a.toLowerCase() === b.toLowerCase();

export function proofActions(job: ProofJobInput, me: string | null, nowSeconds: bigint): NextAction[] {
  const isPayer = same(job.payer, me);
  const isWorker = same(job.worker, me);
  const isVerifier = job.verifiers.some((v) => same(v, me));
  if (!isPayer && !isWorker && !isVerifier) return [];
  const base = { kind: "proof" as const, jobId: job.id, title: job.title };
  const out = (action: string, detail: string, owner: "you" | "waiting"): NextAction =>
    ({ ...base, key: `proof:${job.id}:${action}`, action, detail, owner });

  const open = job.status === ProofStatus.funded || job.status === ProofStatus.submitted ||
    job.status === ProofStatus.needsChanges;
  const v2 = (job.rules ?? 1) >= 2;
  if (open && nowSeconds > job.reviewDeadline) {
    // Version 2: delivered on time and nobody voted it down means the worker is paid.
    if (v2 && job.status === ProofStatus.submitted && (job.failVotes ?? 0) === 0) {
      return [isWorker
        ? out("Collect your pay", "No reviewer objected before the deadline, so the job pays you. Close it to release the money.", "you")
        : out("Worker is owed the pay", "No reviewer objected before the deadline, so closing the job pays the worker.", "waiting")];
    }
    return [isPayer
      ? out("Reclaim your funds", "The review deadline passed without approval. The reward and unused fees can come back to you.", "you")
      : out("Deadline passed", "This job closed without approval. The client can reclaim the funds.", "waiting")];
  }

  // Version 2: one side asked to cancel; the other decides.
  const consents = job.cancelConsents ?? 0;
  if (v2 && open && consents !== 0) {
    const askedByClient = (consents & 1) !== 0;
    if ((askedByClient && isWorker) || (!askedByClient && isPayer))
      return [out("Answer a cancellation request",
        `The ${askedByClient ? "client" : "worker"} asked to call this job off. If you agree, the client gets back everything not yet earned.`, "you")];
    if (isPayer || isWorker)
      return [out("Waiting on your cancellation request", `The ${askedByClient ? "worker" : "client"} hasn't answered yet.`, "waiting")];
  }

  switch (job.status) {
    case ProofStatus.draft:
      if (nowSeconds >= job.deliveryDeadline) return [];
      if (!job.workerAccepted) {
        return [isWorker
          ? out("Accept the terms", "Read the locked brief and test. Accepting lets the client fund the escrow.", "you")
          : out("Waiting for the worker", "The worker has to accept the terms before the job can be funded.", "waiting")];
      }
      return [isPayer
        ? out("Fund the escrow", "The worker accepted. Deposit the reward and reviewer fees to start the job.", "you")
        : out("Waiting for funding", "The client has to deposit the reward before work starts.", "waiting")];
    case ProofStatus.funded:
    case ProofStatus.needsChanges: {
      const again = job.status === ProofStatus.needsChanges;
      return [isWorker
        ? out(again ? "Resubmit your work" : "Submit your work",
          again ? "A reviewer asked for changes. Submit a new commit and deployment." : "The money is locked. Deliver, then submit the commit and deployment.", "you")
        : out(again ? "Waiting for a resubmission" : "Waiting for delivery", "The worker has not submitted evidence yet.", "waiting")];
    }
    case ProofStatus.submitted:
      if (isVerifier && job.votedCurrentVersion === false) {
        return [out("Review and vote", "Evidence is in. Read the Proof Engine report and cast your vote.", "you")];
      }
      return [out("In review", "Evidence is in. Two of three pass votes release payment.", "waiting")];
    default:
      return [];
  }
}

export function milestoneActions(job: MilestoneJobInput, me: string | null, nowSeconds: bigint): NextAction[] {
  const isPayer = same(job.payer, me);
  const isWorker = same(job.worker, me);
  const hasVerifier = !same(job.verifier, ZERO);
  const isVerifier = hasVerifier && same(job.verifier, me);
  if (!isPayer && !isWorker && !isVerifier) return [];
  const base = { kind: "milestone" as const, jobId: job.id, title: job.title };
  const actions: NextAction[] = [];
  const add = (action: string, detail: string, owner: "you" | "waiting") =>
    actions.push({ ...base, key: `milestone:${job.id}:${action}`, action, detail, owner });

  // Earned money is withdrawable in any state, including after cancellation.
  if (isWorker && job.workerEarned > job.workerWithdrawn) {
    add("Withdraw your pay", "Approved milestones have been credited to you.", "you");
  }
  if (isVerifier && job.verifierEarned > job.verifierWithdrawn) {
    add("Withdraw your review fees", "Your approvals earned fees you have not withdrawn.", "you");
  }

  const expired = nowSeconds >= job.expiry;
  const v2 = (job.rules ?? 1) >= 2;
  const current = job.nextMilestone;
  const windowEnd = (job.submittedAt ?? 0n) + REVIEW_WINDOW;
  const lapsed = v2 && job.states[current] === 1 && (job.submittedAt ?? 0n) > 0n && nowSeconds >= windowEnd;
  // Version 2: the approver let the window pass, so the milestone can be paid.
  if (job.funded && !job.cancelled && lapsed) {
    const title = job.milestones[current]?.title ?? `milestone ${current + 1}`;
    if (isWorker) add(`Release payment for ${title}`, "The approver didn't decide within 5 days of your submission, so it can be paid now.", "you");
    else add("Milestone payable on silence", `No decision on ${title} within 5 days, so the worker can release its payment.`, "waiting");
    return actions;
  }
  if (job.funded && (job.cancelled || expired)) {
    // Version 2: a submission still inside its window must be decided first.
    if (v2 && !job.cancelled && job.states[current] === 1 && nowSeconds < windowEnd) {
      const m = job.milestones[current];
      const title = m?.title ?? `milestone ${current + 1}`;
      const approverIsMe = m?.external ? isVerifier : isPayer;
      if (approverIsMe) add(`Review milestone ${current + 1}, ${title}`, "It was submitted before the deadline, so it still gets its 5-day window. Decide before it closes, or the worker is paid.", "you");
      else if (isPayer) add("Wait for the review window", "A milestone was submitted before the deadline. It has to be decided, or its 5-day window pass, before you can reclaim the rest.", "waiting");
      else add("Waiting for approval", `${title} is inside its review window.`, "waiting");
    } else if (job.reserved > 0n) {
      if (isPayer) add("Reclaim unearned funds", job.cancelled ? "Everyone agreed to cancel. Take back what was never earned." : "The deadline passed. Take back what was never earned.", "you");
      else add("Job closed", job.cancelled ? "The job was cancelled. The client can reclaim unearned funds." : "The deadline passed. The client can reclaim unearned funds.", "waiting");
    }
    return actions;
  }

  if (!job.funded) {
    if (expired) return actions;
    const bit = isPayer ? 1 : isWorker ? 2 : 4;
    const required = hasVerifier ? 7 : 3;
    if ((job.acceptances & bit) === 0) {
      add("Accept the terms", "Review the milestones and amounts. Funding needs every party's acceptance.", "you");
    } else if (job.acceptances !== required) {
      add("Waiting for acceptances", "Everyone named on the job has to accept before it can be funded.", "waiting");
    } else if (isPayer) {
      add("Fund the escrow", "Everyone accepted. Deposit the full project amount to start.", "you");
    } else {
      add("Waiting for funding", "Everyone accepted. The client can now fund the job.", "waiting");
    }
    return actions;
  }

  const index = job.nextMilestone;
  if (index >= job.milestones.length) return actions;
  const milestone = job.milestones[index];
  const label = `milestone ${index + 1}, ${milestone.title}`;
  const approverIsMe = milestone.external ? isVerifier : isPayer;
  if (job.states[index] === 0) {
    if (isWorker) add(`Submit ${label}`, "Deliver this milestone and submit your evidence for approval.", "you");
    else add("Waiting for delivery", `The worker is on ${label}.`, "waiting");
  } else if (job.states[index] === 1) {
    if (approverIsMe) add(`Review ${label}`, "Evidence is in. Approve to release payment, or send it back with notes.", "you");
    else add("Waiting for approval", `${label[0].toUpperCase()}${label.slice(1)} is submitted and waiting for approval.`, "waiting");
  }
  return actions;
}
