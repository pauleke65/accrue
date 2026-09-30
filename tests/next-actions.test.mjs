import test from "node:test";
import assert from "node:assert/strict";
import { proofActions, milestoneActions, ProofStatus } from "../lib/next-actions.ts";

const PAYER = "0x00000000000000000000000000000000000000a1";
const WORKER = "0x00000000000000000000000000000000000000b2";
const V1 = "0x00000000000000000000000000000000000000c3";
const V2 = "0x00000000000000000000000000000000000000c4";
const V3 = "0x00000000000000000000000000000000000000c5";
const ZERO = "0x0000000000000000000000000000000000000000";
const NOW = 1_000n;

const proof = (over = {}) => ({
  id: "p1", title: "Rates API", payer: PAYER, worker: WORKER, verifiers: [V1, V2, V3],
  status: ProofStatus.draft, workerAccepted: false, deliveryDeadline: 2_000n, reviewDeadline: 3_000n,
  votedCurrentVersion: null, ...over,
});

const milestone = (over = {}) => ({
  id: "m1", title: "Site rebuild", payer: PAYER, worker: WORKER, verifier: V1,
  milestones: [{ title: "Wireframes", external: true }, { title: "Build", external: true }],
  states: [0, 0], acceptances: 0, funded: false, cancelled: false, expiry: 5_000n, reserved: 0n,
  nextMilestone: 0, workerEarned: 0n, workerWithdrawn: 0n, verifierEarned: 0n, verifierWithdrawn: 0n, ...over,
});

const owners = (list) => list.map((a) => `${a.owner}:${a.action}`);

test("proof job: worker accepts first, then the client funds", () => {
  assert.deepEqual(owners(proofActions(proof(), WORKER, NOW)), ["you:Accept the terms"]);
  assert.deepEqual(owners(proofActions(proof(), PAYER, NOW)), ["waiting:Waiting for the worker"]);
  const accepted = proof({ workerAccepted: true });
  assert.deepEqual(owners(proofActions(accepted, PAYER, NOW)), ["you:Fund the escrow"]);
  assert.deepEqual(owners(proofActions(accepted, WORKER, NOW)), ["waiting:Waiting for funding"]);
});

test("proof job: verifiers are asked to vote only until they have", () => {
  const submitted = proof({ status: ProofStatus.submitted, votedCurrentVersion: false });
  assert.deepEqual(owners(proofActions(submitted, V2, NOW)), ["you:Review and vote"]);
  const voted = proof({ status: ProofStatus.submitted, votedCurrentVersion: true });
  assert.deepEqual(owners(proofActions(voted, V2, NOW)), ["waiting:In review"]);
});

test("proof job: an open job past review deadline is the client's to reclaim", () => {
  const late = proof({ status: ProofStatus.funded });
  assert.deepEqual(owners(proofActions(late, PAYER, 3_001n)), ["you:Reclaim your funds"]);
  assert.deepEqual(owners(proofActions(late, WORKER, 3_001n)), ["waiting:Deadline passed"]);
});

test("proof job: strangers and finished jobs produce nothing", () => {
  assert.deepEqual(proofActions(proof(), "0x00000000000000000000000000000000000000ff", NOW), []);
  assert.deepEqual(proofActions(proof({ status: ProofStatus.paid }), PAYER, NOW), []);
});

test("milestone job: funding waits for every required acceptance", () => {
  assert.deepEqual(owners(milestoneActions(milestone(), V1, NOW)), ["you:Accept the terms"]);
  assert.deepEqual(owners(milestoneActions(milestone({ acceptances: 1 }), PAYER, NOW)), ["waiting:Waiting for acceptances"]);
  assert.deepEqual(owners(milestoneActions(milestone({ acceptances: 7 }), PAYER, NOW)), ["you:Fund the escrow"]);
  // Without a verifier, client and worker are enough.
  const selfApproved = milestone({ verifier: ZERO, acceptances: 3, milestones: [{ title: "Draft", external: false }], states: [0] });
  assert.deepEqual(owners(milestoneActions(selfApproved, PAYER, NOW)), ["you:Fund the escrow"]);
});

test("milestone job: submissions go to the right approver", () => {
  const funded = milestone({ acceptances: 7, funded: true, reserved: 100n });
  assert.deepEqual(owners(milestoneActions(funded, WORKER, NOW)), ["you:Submit milestone 1, Wireframes"]);
  const inReview = { ...funded, states: [1, 0] };
  assert.deepEqual(owners(milestoneActions(inReview, V1, NOW)), ["you:Review milestone 1, Wireframes"]);
  assert.deepEqual(owners(milestoneActions(inReview, PAYER, NOW)), ["waiting:Waiting for approval"]);
  const clientApproves = { ...inReview, milestones: [{ title: "Wireframes", external: false }, { title: "Build", external: false }] };
  assert.deepEqual(owners(milestoneActions(clientApproves, PAYER, NOW)), ["you:Review milestone 1, Wireframes"]);
});

test("milestone job: earned pay is withdrawable, even after the job closes", () => {
  const closed = milestone({ acceptances: 7, funded: true, cancelled: true, reserved: 50n, workerEarned: 150n, states: [2, 0], nextMilestone: 1 });
  assert.deepEqual(owners(milestoneActions(closed, WORKER, NOW)), ["you:Withdraw your pay", "waiting:Job closed"]);
  assert.deepEqual(owners(milestoneActions(closed, PAYER, NOW)), ["you:Reclaim unearned funds"]);
});

// ---- Contract rules version 2 ----

test("v2 proof job: silence at the deadline pays the worker", () => {
  const silent = proof({ status: ProofStatus.submitted, rules: 2, failVotes: 0 });
  assert.deepEqual(owners(proofActions(silent, WORKER, 3_001n)), ["you:Collect your pay"]);
  assert.deepEqual(owners(proofActions(silent, PAYER, 3_001n)), ["waiting:Worker is owed the pay"]);
  // A fail vote keeps the old refund path; version 1 always refunds.
  assert.deepEqual(owners(proofActions({ ...silent, failVotes: 1 }, PAYER, 3_001n)), ["you:Reclaim your funds"]);
  assert.deepEqual(owners(proofActions({ ...silent, rules: 1 }, PAYER, 3_001n)), ["you:Reclaim your funds"]);
});

test("v2 proof job: a cancellation request goes to the other side", () => {
  const asked = proof({ status: ProofStatus.funded, rules: 2, cancelConsents: 1 });
  assert.deepEqual(owners(proofActions(asked, WORKER, NOW)), ["you:Answer a cancellation request"]);
  assert.deepEqual(owners(proofActions(asked, PAYER, NOW)), ["waiting:Waiting on your cancellation request"]);
});

test("v2 milestone: a lapsed review window lets the worker release payment", () => {
  const funded = milestone({ acceptances: 7, funded: true, reserved: 100n, states: [1, 0], rules: 2, submittedAt: 100n });
  const later = 100n + 5n * 86_400n;
  assert.deepEqual(owners(milestoneActions(funded, WORKER, later)), ["you:Release payment for Wireframes"]);
  assert.deepEqual(owners(milestoneActions(funded, V1, later - 1n)), ["you:Review milestone 1, Wireframes"]);
});

test("v2 milestone: a submission inside its window blocks the refund, and the approver is asked", () => {
  const expiring = milestone({ acceptances: 7, funded: true, reserved: 100n, states: [1, 0], rules: 2, submittedAt: 4_900n });
  assert.deepEqual(owners(milestoneActions(expiring, PAYER, 5_001n)), ["waiting:Wait for the review window"]);
  assert.deepEqual(owners(milestoneActions(expiring, V1, 5_001n)), ["you:Review milestone 1, Wireframes"]);
});
