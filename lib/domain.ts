import type {Role,Evidence,Milestone,Entry,Agreement,Action,Draft} from "./domain-types";
export type {Role,Evidence,Milestone,Entry,Agreement,Action,Draft} from "./domain-types";
export function total(a: Agreement) {
  return a.milestones.reduce((sum, m) => sum + m.amount + m.fee, 0);
}
export function available(a: Agreement, role: "earner" | "verifier") {
  return a.earned[role] - a.withdrawn[role];
}
export function requiredRoles(a: Agreement): Role[] {
  return a.milestones.some((m) => m.approver === "verifier")
    ? ["payer", "earner", "verifier"]
    : ["payer", "earner"];
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function assertAccounting(a: Agreement) {
  ensure(
    a.funded === a.reserved + a.earned.earner + a.earned.verifier + a.refunded,
    "Accounting invariant failed",
  );
  for (const n of [
    a.reserved,
    a.refunded,
    a.earned.earner,
    a.earned.verifier,
    available(a, "earner"),
    available(a, "verifier"),
  ])
    ensure(Number.isSafeInteger(n) && n >= 0, "Invalid balance");
}
export function createAgreement(
  draft: Draft,
  id: string,
  now = new Date().toISOString(),
): Agreement {
  ensure(
    draft.milestones.length > 0 && draft.milestones.length <= 12,
    "Choose 1–12 milestones",
  );
  ensure(
    Date.parse(draft.expiry) > Date.parse(now),
    "Expiry must be in the future",
  );
  for (const m of draft.milestones) {
    ensure(
      Number.isSafeInteger(m.amount) && m.amount > 0 && m.amount <= 100000000,
      "Invalid worker allocation",
    );
    ensure(
      Number.isSafeInteger(m.fee) && m.fee >= 0 && m.fee <= 10000000,
      "Invalid verifier fee",
    );
    ensure(
      m.approver === "verifier" || m.fee === 0,
      "Payer-approved milestones cannot have a verifier fee",
    );
  }
  return {
    ...draft,
    id,
    version: 1,
    createdAt: now,
    accepted: ["payer"],
    status: "awaiting",
    milestones: draft.milestones.map((m) => ({
      ...m,
      status: "waiting",
      evidence: [],
    })),
    funded: 0,
    reserved: 0,
    earned: { earner: 0, verifier: 0 },
    withdrawn: { earner: 0, verifier: 0 },
    refunded: 0,
    cancelVotes: [],
    operations: [],
    timeline: [
      {
        id: crypto.randomUUID(),
        at: now,
        actor: "payer",
        action: "created",
        message: "Agreement created. Payer accepted these fixed terms.",
        amount: 0,
      },
    ],
  };
}
export function applyAction(
  original: Agreement,
  action: Action,
  now = new Date().toISOString(),
): Agreement {
  if (original.operations.includes(action.operationId)) return original;
  const a: Agreement = structuredClone(original);
  const entry: Entry = {
    id: action.operationId,
    at: now,
    actor: action.role,
    action: action.type,
    message: "",
    amount: 0,
  };
  const expired = Date.parse(now) >= Date.parse(a.expiry);
  const m =
    action.milestone === undefined ? undefined : a.milestones[action.milestone];
  if (action.type === "accept") {
    ensure(
      a.status === "awaiting" && !expired,
      "Agreement is not open for acceptance",
    );
    ensure(
      requiredRoles(a).includes(action.role) &&
        !a.accepted.includes(action.role),
      "Role already accepted or not required",
    );
    a.accepted.push(action.role);
    if (requiredRoles(a).every((r) => a.accepted.includes(r)))
      a.status = "ready";
    entry.message = `${action.role} accepted version 1 of the terms.`;
  } else if (action.type === "fund") {
    ensure(
      action.role === "payer" && a.status === "ready" && !expired,
      "Only the payer can fund fully accepted, unexpired terms",
    );
    a.funded = total(a);
    a.reserved = a.funded;
    a.status = "active";
    entry.amount = a.funded;
    entry.message = "Sandbox funds reserved for all milestones.";
  } else if (["submit", "approve", "changes"].includes(action.type)) {
    ensure(
      a.status === "active" && !expired,
      "Agreement is not active or has expired",
    );
    ensure(
      m && m.status !== "approved",
      "Milestone is missing or already approved",
    );
    ensure(
      a.milestones
        .slice(0, action.milestone)
        .every((item) => item.status === "approved"),
      "Complete earlier milestones first",
    );
    applyMilestone(a, m, action, entry, now);
  } else if (action.type === "withdraw") {
    ensure(
      action.role === "earner" || action.role === "verifier",
      "Only beneficiaries can withdraw their earnings",
    );
    const amount = available(a, action.role);
    ensure(amount > 0, "No earnings available");
    a.withdrawn[action.role] += amount;
    entry.amount = amount;
    entry.message = `Sandbox withdrawal to the ${action.role} account completed.`;
  } else if (action.type === "refund") {
    ensure(
      action.role === "payer" && (expired || a.status === "cancelled"),
      "Refund requires expiry or mutual cancellation",
    );
    ensure(a.reserved > 0, "No unused funds to return");
    entry.amount = a.reserved;
    a.refunded += a.reserved;
    a.reserved = 0;
    if (a.status !== "cancelled") a.status = "expired";
    entry.message = "Unused reserve returned. Earned balances are unchanged.";
  } else if (action.type === "cancel") {
    ensure(
      a.status === "active" && !expired,
      "Only an active agreement can be mutually cancelled",
    );
    ensure(
      requiredRoles(a).includes(action.role) &&
        !a.cancelVotes.includes(action.role),
      "Role is not required or already consented",
    );
    a.cancelVotes.push(action.role);
    entry.message = `${action.role} consented to cancellation. Earnings remain protected.`;
    if (requiredRoles(a).every((r) => a.cancelVotes.includes(r)))
      a.status = "cancelled";
  } else if (action.type === "correct") {
    ensure(
      m?.status === "approved" && action.role === m.approver,
      "Only the original approver can append a correction",
    );
    ensure(action.notes?.trim(), "Describe the correction");
    entry.message = `Correction for ${m.title}: ${action.notes}`;
  } else throw new Error("Unsupported action");
  if (
    a.funded > 0 &&
    a.reserved === 0 &&
    available(a, "earner") === 0 &&
    available(a, "verifier") === 0
  )
    a.status = "complete";
  a.version++;
  a.operations.push(action.operationId);
  a.timeline.push(entry);
  assertAccounting(a);
  return a;
}
function applyMilestone(
  a: Agreement,
  m: Milestone,
  action: Action,
  entry: Entry,
  now: string,
) {
  if (action.type === "submit") {
    ensure(
      action.role === "earner" && ["waiting", "changes"].includes(m.status),
      "Only the earner can submit work awaiting evidence",
    );
    ensure(
      action.notes?.trim() && action.digest,
      "Evidence notes and digest are required",
    );
    m.evidence.push({
      version: m.evidence.length + 1,
      notes: action.notes!,
      files: action.files ?? [],
      digest: action.digest!,
      at: now,
    });
    m.status = "submitted";
    entry.digest = action.digest;
    entry.message = `Evidence v${m.evidence.length} submitted for ${m.title}.`;
  } else {
    ensure(
      action.role === m.approver && m.status === "submitted",
      "Only the named approver can review submitted evidence",
    );
    if (action.type === "changes") {
      ensure(action.notes?.trim(), "Explain the changes needed");
      m.feedback = action.notes;
      m.status = "changes";
      entry.message = `Changes requested for ${m.title}: ${action.notes}`;
    } else {
      ensure(
        action.digest === m.evidence.at(-1)?.digest,
        "Evidence version changed; review it again",
      );
      m.status = "approved";
      a.reserved -= m.amount + m.fee;
      a.earned.earner += m.amount;
      a.earned.verifier += m.fee;
      entry.amount = m.amount + m.fee;
      entry.digest = action.digest;
      entry.message = `${m.title} verified. Worker and verifier allocations credited together.`;
    }
  }
}

