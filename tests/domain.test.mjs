import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgreement,
  applyAction,
  assertAccounting,
  available,
} from "../lib/domain.ts";
const now = "2026-09-10T12:00:00.000Z";
const draft = {
  title: "Test job",
  scope: "Complete the agreed work",
  earner: "Worker",
  verifier: "Engineer",
  expiry: "2026-10-10T12:00:00.000Z",
  milestones: [
    {
      title: "One",
      criteria: "Must meet all criteria",
      amount: 10000,
      fee: 300,
      approver: "verifier",
    },
    {
      title: "Two",
      criteria: "Must meet all criteria",
      amount: 20000,
      fee: 600,
      approver: "verifier",
    },
  ],
};
const act = (a, type, role, extras = {}) =>
  applyAction(
    a,
    { type, role, operationId: crypto.randomUUID(), ...extras },
    now,
  );
function funded() {
  let a = createAgreement(draft, crypto.randomUUID(), now);
  a = act(a, "accept", "earner");
  a = act(a, "accept", "verifier");
  return act(a, "fund", "payer");
}
function approved() {
  let a = funded();
  a = act(a, "submit", "earner", {
    milestone: 0,
    notes: "Work completed",
    digest: "a".repeat(64),
  });
  return act(a, "approve", "verifier", {
    milestone: 0,
    digest: "a".repeat(64),
  });
}
test("requires every participant before funding", () =>
  assert.throws(() => act(createAgreement(draft, "a", now), "fund", "payer")));
test("approval atomically credits both allocations", () => {
  const a = approved();
  assert.equal(a.earned.earner, 10000);
  assert.equal(a.earned.verifier, 300);
  assert.equal(a.reserved, 20600);
  assertAccounting(a);
});
test("wrong role cannot approve, fund, submit, or withdraw", () => {
  let a = funded();
  assert.throws(() =>
    act(a, "submit", "payer", { milestone: 0, notes: "x", digest: "a" }),
  );
  a = act(a, "submit", "earner", { milestone: 0, notes: "x", digest: "a" });
  assert.throws(() =>
    act(a, "approve", "earner", { milestone: 0, digest: "a" }),
  );
  assert.throws(() => act(a, "withdraw", "payer"));
  assert.throws(() => act(a, "fund", "verifier"));
});
test("same operation is idempotent", () => {
  const a = funded(),
    action = {
      type: "submit",
      role: "earner",
      operationId: crypto.randomUUID(),
      milestone: 0,
      notes: "Complete",
      digest: "a",
    };
  const b = applyAction(a, action, now);
  assert.deepEqual(applyAction(b, action, now), b);
});
test("double approval cannot pay twice", () =>
  assert.throws(() =>
    act(approved(), "approve", "verifier", {
      milestone: 0,
      digest: "a".repeat(64),
    }),
  ));
test("withdraw cannot happen twice", () => {
  const a = act(approved(), "withdraw", "earner");
  assert.equal(available(a, "earner"), 0);
  assert.throws(() => act(a, "withdraw", "earner"));
  assertAccounting(a);
});
test("expiry refunds only reserve, earned remains withdrawable", () => {
  let a = approved();
  a = applyAction(
    a,
    { type: "refund", role: "payer", operationId: crypto.randomUUID() },
    draft.expiry,
  );
  assert.equal(a.refunded, 20600);
  assert.equal(available(a, "earner"), 10000);
  assert.equal(a.earned.verifier, 300);
  a = act(a, "withdraw", "earner");
  assertAccounting(a);
});
test("expiry boundary blocks approvals", () => {
  let a = funded();
  a = act(a, "submit", "earner", { milestone: 0, notes: "Done", digest: "a" });
  assert.throws(() =>
    applyAction(
      a,
      {
        type: "approve",
        role: "verifier",
        milestone: 0,
        digest: "a",
        operationId: crypto.randomUUID(),
      },
      draft.expiry,
    ),
  );
});
test("unilateral cancellation and early refund fail", () => {
  let a = approved();
  a = act(a, "cancel", "payer");
  assert.equal(a.status, "active");
  assert.throws(() => act(a, "refund", "payer"));
  a = act(a, "cancel", "earner");
  a = act(a, "cancel", "verifier");
  a = act(a, "refund", "payer");
  assert.equal(a.earned.earner, 10000);
  assertAccounting(a);
});
test("resubmission preserves versions and rejects stale approval", () => {
  let a = funded();
  a = act(a, "submit", "earner", { milestone: 0, notes: "First", digest: "a" });
  a = act(a, "changes", "verifier", {
    milestone: 0,
    notes: "Need more evidence",
  });
  a = act(a, "submit", "earner", {
    milestone: 0,
    notes: "Second",
    digest: "b",
  });
  assert.equal(a.milestones[0].evidence.length, 2);
  assert.throws(() =>
    act(a, "approve", "verifier", { milestone: 0, digest: "a" }),
  );
  a = act(a, "approve", "verifier", { milestone: 0, digest: "b" });
  assertAccounting(a);
});
test("correction never reverses payment", () => {
  let a = approved();
  a = act(a, "correct", "verifier", { milestone: 0, notes: "Clarification" });
  assert.equal(a.earned.earner, 10000);
  assert.equal(a.timeline.at(-1).action, "correct");
});
test("milestone order enforced", () =>
  assert.throws(() =>
    act(funded(), "submit", "earner", {
      milestone: 1,
      notes: "Done",
      digest: "a",
    }),
  ));
test("payer approval has no verifier allocation", () => {
  const d = {
    ...draft,
    verifier: "",
    milestones: [{ ...draft.milestones[0], fee: 0, approver: "payer" }],
  };
  let a = createAgreement(d, "p", now);
  a = act(a, "accept", "earner");
  a = act(a, "fund", "payer");
  a = act(a, "submit", "earner", { milestone: 0, notes: "Done", digest: "a" });
  a = act(a, "approve", "payer", { milestone: 0, digest: "a" });
  assert.equal(a.earned.verifier, 0);
  assertAccounting(a);
});
test("rejects fractional and negative money", () => {
  for (const amount of [-1, 0, 1.2, Infinity])
    assert.throws(() =>
      createAgreement(
        { ...draft, milestones: [{ ...draft.milestones[0], amount }] },
        "bad",
        now,
      ),
    );
});
test("random complete journeys preserve conservation", () => {
  for (let i = 0; i < 100; i++) {
    let a = funded();
    for (let m = 0; m < 2; m++) {
      a = act(a, "submit", "earner", {
        milestone: m,
        notes: "Done",
        digest: "a",
      });
      a = act(a, "approve", "verifier", { milestone: m, digest: "a" });
      if (Math.random() > 0.5) a = act(a, "withdraw", "earner");
      assertAccounting(a);
    }
    for (const role of ["earner", "verifier"])
      if (available(a, role)) a = act(a, "withdraw", role);
    assert.equal(a.status, "complete");
    assertAccounting(a);
  }
});
