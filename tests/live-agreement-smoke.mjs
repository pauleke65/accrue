/**
 * A funded job, end to end, the way the interface does it.
 *
 * This is the join the product was missing: a payer names a worker and a
 * verifier by tag, the contract holds real AUSD, the readable terms live
 * beside it, and each role signs its own actions. The script walks that path
 * through the app's own API and the deployed escrow, and checks the money
 * against the chain at every step.
 *
 * Needs the local server, a funded sponsor, and testnet keys in .env.local.
 *
 *   node tests/live-agreement-smoke.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { readBalance } from "../lib/ausd.ts";
import {
  callEscrow,
  approveDeposit,
  readAgreement,
  readMilestones,
  readNextId,
  hashText,
  MilestoneState,
} from "../lib/escrow.ts";
import { escrow, network, parseAmount, formatAmount } from "../lib/chain.ts";

const base = process.env.ACCRUE_TEST_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Smoke tests are local-only.");

const ENV = new URL("../.env.local", import.meta.url).pathname;
const env = Object.fromEntries(
  (existsSync(ENV) ? readFileSync(ENV, "utf8") : "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);

const payer = privateKeyToAccount(env.ACCRUE_TESTNET_DEPLOYER_KEY);
const worker = privateKeyToAccount(env.ACCRUE_TESTNET_WORKER_KEY);
const verifier = privateKeyToAccount(env.ACCRUE_TESTNET_VERIFIER_KEY);

const auth = await fetch(base + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = auth.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "local sign-in cookie");

const api = async (path, body, method = body ? "POST" : "GET") => {
  const response = await fetch(base + path, {
    method,
    headers: {
      cookie,
      origin: base,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
};

const log = (step, detail) => console.log(`  ${step.padEnd(24)} ${detail}`);
const stamp = Date.now().toString(36).slice(-5);

/* ------------------------------------------------- tags for the participants */

for (const [name, account] of [
  [`bola_${stamp}`, worker],
  [`ngozi_${stamp}`, verifier],
]) {
  const signature = await account.signMessage({
    message: `Accrue: claim the tag @${name} for ${account.address}`,
  });
  const result = await api("/api/tags", {
    tag: name,
    address: account.address,
    displayName: name,
    signature,
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
}
const workerTag = `bola_${stamp}`;
const verifierTag = `ngozi_${stamp}`;
log("tags claimed", `@${workerTag}, @${verifierTag}`);

// The payer names people, not addresses. Resolution is what turns one into
// the other, and it must agree with the accounts that will sign.
const resolvedWorker = await api(`/api/tags?tag=${workerTag}`);
assert.equal(resolvedWorker.data.address, worker.address);
log("tag resolves", `@${workerTag} → ${worker.address.slice(0, 10)}…`);

/* ------------------------------------------------------------------ create */

const workerAmount = parseAmount("60.00");
const verifierFee = parseAmount("4.00");
const deposit = workerAmount + verifierFee;

const scope = "Repaint the ground-floor living space. Excludes furniture.";
const criteria = "Two coats, cut in cleanly, no visible roller marks.";
const milestones = [
  {
    workerAmount,
    verifierFee,
    externalVerifier: true,
    criteriaHash: hashText(criteria),
  },
];
const expiry = BigInt(Math.floor(Date.now() / 1000) + 3 * 86_400);

const id = await readNextId();
let state = await callEscrow({
  account: payer,
  functionName: "create",
  args: [
    worker.address,
    verifier.address,
    expiry,
    hashText(scope),
    milestones,
  ],
});
assert.equal(state.status, "confirmed", "create must confirm");
log("created on chain", `agreement #${id}`);

// The readable terms are recorded beside the contract, which keeps only hashes.
const recorded = await api("/api/live-agreements", {
  chainId: network.chainId,
  escrow: escrow.address,
  onchainId: id.toString(),
  title: "Living room repaint",
  scope,
  payer: payer.address,
  worker: worker.address,
  verifier: verifier.address,
  workerTag,
  verifierTag,
  milestones: [
    {
      title: "Repaint",
      criteria,
      criteriaHash: hashText(criteria),
      workerAmount: workerAmount.toString(),
      verifierFee: verifierFee.toString(),
    },
  ],
});
assert.equal(recorded.status, 201, JSON.stringify(recorded.data));
log("terms recorded", recorded.data.id);

// What the app stored must hash to what the contract holds, or the readable
// terms and the enforced terms would be two different agreements.
const listed = await api("/api/live-agreements");
const mine = listed.data.agreements.find((a) => a.onchainId === id.toString());
assert.ok(mine, "the agreement must be listed");
assert.equal(
  mine.milestones[0].criteriaHash,
  hashText(mine.milestones[0].criteria),
  "stored criteria must hash to the value the contract enforces",
);
assert.equal(mine.workerTag, workerTag);
log("terms verified", "stored text hashes to the contract's value");

/* ------------------------------------------------- accept, fund, do the work */

for (const [name, account] of [
  ["worker", worker],
  ["verifier", verifier],
]) {
  const onChain = await readAgreement(id);
  state = await callEscrow({
    account,
    functionName: "accept",
    args: [id, onChain.termsHash],
  });
  assert.equal(state.status, "confirmed", `${name} must accept`);
}
log("accepted", "worker and verifier");

await approveDeposit({ account: payer, amount: deposit });
state = await callEscrow({ account: payer, functionName: "fund", args: [id] });
assert.equal(state.status, "confirmed", "funding must confirm");
let onChain = await readAgreement(id);
assert.equal(onChain.reserved, deposit, "the deposit must be reserved");
log("funded", `${formatAmount(deposit)} AUSD reserved`);

const evidence = hashText("Two coats applied on 12 September.");
state = await callEscrow({
  account: worker,
  functionName: "submitEvidence",
  args: [id, 0n, evidence],
});
assert.equal(state.status, "confirmed");
let milestonesNow = await readMilestones(id);
assert.equal(milestonesNow[0].state, MilestoneState.submitted);
log("evidence submitted", "awaiting the verifier");

const workerBefore = await readBalance(worker.address);
const verifierBefore = await readBalance(verifier.address);

state = await callEscrow({
  account: verifier,
  functionName: "approve",
  args: [id, 0n, evidence],
});
assert.equal(state.status, "confirmed", "the verifier must be able to approve");
onChain = await readAgreement(id);
assert.equal(onChain.workerEarned, workerAmount);
assert.equal(onChain.verifierEarned, verifierFee);
assert.equal(onChain.reserved, 0n);
log("approved", "worker and verifier credited together");

/* --------------------------------------------------------------- withdrawals */

for (const [name, account, expected, before] of [
  ["worker", worker, workerAmount, workerBefore],
  ["verifier", verifier, verifierFee, verifierBefore],
]) {
  state = await callEscrow({
    account,
    functionName: "withdraw",
    args: [id],
  });
  assert.equal(state.status, "confirmed", `${name} must withdraw`);
  assert.equal(
    (await readBalance(account.address)) - before,
    expected,
    `${name} must receive exactly the agreed allocation`,
  );
}
log("withdrawn", "worker and verifier paid in full");

milestonesNow = await readMilestones(id);
assert.equal(milestonesNow[0].state, MilestoneState.earned);

console.log(
  "\n" +
    JSON.stringify(
      {
        passed: true,
        agreement: Number(id),
        escrow: escrow.address,
        deposit: formatAmount(deposit),
        proven: [
          "a payer names people by tag, not by address",
          "tags resolve to the accounts that sign",
          "readable terms hash to the values the contract enforces",
          "the contract holds real AUSD until work is verified",
          "approval credits worker and verifier together",
          "each role is paid exactly what was agreed",
        ],
      },
      null,
      2,
    ),
);
