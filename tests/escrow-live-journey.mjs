/**
 * One genuine three-account milestone journey on Monad testnet.
 *
 * Payer, worker and verifier are separate accounts signing their own
 * transactions, so the contract's authorization is exercised for real rather
 * than simulated by a role switch. The script asserts the accounting after
 * every step and fails loudly if a balance is off by a single base unit.
 *
 * It spends testnet MON for gas and moves testnet AUSD. Nothing here is money.
 *
 *   node tests/escrow-live-journey.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { parseEther } from "viem";
import { publicClient, walletClient, readBalance } from "../lib/ausd.ts";
import {
  callEscrow,
  approveDeposit,
  readAgreement,
  readMilestones,
  readNextId,
  hashText,
  termsHash,
  MilestoneState,
} from "../lib/escrow.ts";
import {
  chain,
  escrow,
  token,
  formatAmount,
  parseAmount,
  explorer,
} from "../lib/chain.ts";

const ENV = new URL("../.env.local", import.meta.url).pathname;
const log = (step, detail) => console.log(`  ${step.padEnd(26)} ${detail}`);

/* ---------------------------------------------------------------- accounts */

const env = Object.fromEntries(
  (existsSync(ENV) ? readFileSync(ENV, "utf8") : "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);

let dirty = false;
for (const name of [
  "ACCRUE_TESTNET_WORKER_KEY",
  "ACCRUE_TESTNET_VERIFIER_KEY",
]) {
  if (!env[name]) {
    env[name] = generatePrivateKey();
    dirty = true;
  }
}
if (dirty) {
  writeFileSync(
    ENV,
    "# Local testnet only. Never reuse these keys where real funds can reach them.\n" +
      Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") +
      "\n",
    { mode: 0o600 },
  );
}

const payer = privateKeyToAccount(env.ACCRUE_TESTNET_DEPLOYER_KEY);
const worker = privateKeyToAccount(env.ACCRUE_TESTNET_WORKER_KEY);
const verifier = privateKeyToAccount(env.ACCRUE_TESTNET_VERIFIER_KEY);

console.log(`\nEscrow ${escrow.address} on ${chain.name}\n`);
log("payer", payer.address);
log("worker", worker.address);
log("verifier", verifier.address);

const client = publicClient();

/* --------------------------------------------------------- gas and funding */

for (const [name, account] of [
  ["worker", worker],
  ["verifier", verifier],
]) {
  const gas = await client.getBalance({ address: account.address });
  if (gas < parseEther("0.15")) {
    const hash = await walletClient(payer).sendTransaction({
      to: account.address,
      value: parseEther("0.4"),
      chain,
      account: payer,
    });
    await client.waitForTransactionReceipt({ hash });
    log(`funded ${name} gas`, "0.4 MON");
  }
}

const workerAmount = parseAmount("120.00");
const verifierFee = parseAmount("8.50");
const deposit = workerAmount + verifierFee;

let payerAusd = await readBalance(payer.address);
if (payerAusd < deposit) {
  const drip = await callEscrow({
    account: payer,
    functionName: "nextId",
    args: [],
  }).catch(() => null);
  void drip;
  throw new Error("Payer needs AUSD; run the faucet first.");
}
log("payer AUSD", `${formatAmount(payerAusd)} ${token.symbol}`);

/* ------------------------------------------------------------------ create */

const scope = "Renovate the ground-floor living space. Excludes furniture.";
const criteria = "Foundation poured, cured 72 hours, level within 5mm.";
const scopeHash = hashText(scope);
const expiry = BigInt(Math.floor(Date.now() / 1000) + 3 * 86_400);
const milestones = [
  {
    workerAmount,
    verifierFee,
    externalVerifier: true,
    criteriaHash: hashText(criteria),
  },
];

const expectedId = await readNextId();
let state = await callEscrow({
  account: payer,
  functionName: "create",
  args: [worker.address, verifier.address, expiry, scopeHash, milestones],
});
assert.equal(state.status, "confirmed", "create must confirm");
const id = expectedId;
log("created agreement", `#${id} · ${explorer.tx(state.hash)}`);

let onChain = await readAgreement(id);
assert.equal(onChain.payer.toLowerCase(), payer.address.toLowerCase());
assert.equal(onChain.worker.toLowerCase(), worker.address.toLowerCase());
assert.equal(onChain.deposit, deposit, "deposit must equal worker + verifier");
assert.equal(onChain.funded, false);

// The helper must reproduce the contract's own hash, or a participant could
// accept terms other than the ones they were shown.
const computed = termsHash({
  id,
  payer: payer.address,
  worker: worker.address,
  verifier: verifier.address,
  expiry,
  scopeHash,
  milestones,
});
assert.equal(
  computed,
  onChain.termsHash,
  "locally computed terms hash must match the contract's",
);
log("terms hash", "matches the contract");

/* ------------------------------------------------------- wrong-signer check */

const intruder = privateKeyToAccount(generatePrivateKey());
await walletClient(payer)
  .sendTransaction({
    to: intruder.address,
    value: parseEther("0.1"),
    chain,
    account: payer,
  })
  .then((hash) => client.waitForTransactionReceipt({ hash }));
const refused = await callEscrow({
  account: intruder,
  functionName: "accept",
  args: [id, onChain.termsHash],
});
assert.equal(
  refused.status,
  "failed",
  "an account with no role must not be able to accept",
);
log("stranger accept", "refused by the contract");

/* ------------------------------------------------------------- acceptances */

for (const [name, account] of [
  ["worker", worker],
  ["verifier", verifier],
]) {
  state = await callEscrow({
    account,
    functionName: "accept",
    args: [id, onChain.termsHash],
  });
  assert.equal(state.status, "confirmed", `${name} acceptance must confirm`);
  log(`${name} accepted`, state.hash);
}

/* ------------------------------------------------------------------- fund */

await approveDeposit({ account: payer, amount: deposit });
state = await callEscrow({ account: payer, functionName: "fund", args: [id] });
assert.equal(state.status, "confirmed", "funding must confirm");
onChain = await readAgreement(id);
assert.equal(onChain.funded, true);
assert.equal(onChain.reserved, deposit, "the whole deposit must be reserved");
const escrowHeld = await readBalance(escrow.address);
assert.ok(
  escrowHeld >= deposit,
  "the contract must actually hold the deposit it claims",
);
log("funded", `${formatAmount(deposit)} ${token.symbol} reserved`);

/* --------------------------------------------------------------- evidence */

const evidenceHash = hashText("Foundation poured 10 Sep; level checked.");
state = await callEscrow({
  account: worker,
  functionName: "submitEvidence",
  args: [id, 0n, evidenceHash],
});
assert.equal(state.status, "confirmed");
log("evidence submitted", state.hash);

// The payer is not the approver on this milestone, and must be refused.
const wrongApprover = await callEscrow({
  account: payer,
  functionName: "approve",
  args: [id, 0n, evidenceHash],
});
assert.equal(
  wrongApprover.status,
  "failed",
  "only the named verifier may approve this milestone",
);
log("payer approval", "refused by the contract");

/* ---------------------------------------------------------------- approve */

const workerBefore = await readBalance(worker.address);
const verifierBefore = await readBalance(verifier.address);

state = await callEscrow({
  account: verifier,
  functionName: "approve",
  args: [id, 0n, evidenceHash],
});
assert.equal(state.status, "confirmed", "verifier approval must confirm");
log("verifier approved", state.hash);

onChain = await readAgreement(id);
assert.equal(onChain.workerEarned, workerAmount, "worker must be credited");
assert.equal(onChain.verifierEarned, verifierFee, "verifier must be credited");
assert.equal(onChain.reserved, 0n, "nothing may stay reserved");
log("allocations", "worker and verifier credited together");

// Approving twice must not pay twice.
const replay = await callEscrow({
  account: verifier,
  functionName: "approve",
  args: [id, 0n, evidenceHash],
});
assert.equal(replay.status, "failed", "a second approval must not pay again");
onChain = await readAgreement(id);
assert.equal(onChain.workerEarned, workerAmount, "earnings must not double");
log("double approval", "refused, earnings unchanged");

/* --------------------------------------------------------------- withdraw */

for (const [name, account, expected, before] of [
  ["worker", worker, workerAmount, workerBefore],
  ["verifier", verifier, verifierFee, verifierBefore],
]) {
  state = await callEscrow({
    account,
    functionName: "withdraw",
    args: [id],
  });
  assert.equal(state.status, "confirmed", `${name} withdrawal must confirm`);
  const after = await readBalance(account.address);
  assert.equal(
    after - before,
    expected,
    `${name} must receive exactly the agreed allocation`,
  );
  log(`${name} withdrew`, `${formatAmount(expected)} ${token.symbol}`);

  const twice = await callEscrow({
    account,
    functionName: "withdraw",
    args: [id],
  });
  assert.equal(twice.status, "failed", `${name} must not withdraw twice`);
  assert.equal(
    await readBalance(account.address),
    after,
    "a refused withdrawal must not move anything",
  );
}
log("double withdrawal", "refused, balances unchanged");

/* ------------------------------------------------------------ final state */

onChain = await readAgreement(id);
assert.equal(onChain.workerWithdrawn, workerAmount);
assert.equal(onChain.verifierWithdrawn, verifierFee);
assert.equal(onChain.reserved, 0n);
const milestonesNow = await readMilestones(id);
assert.equal(
  milestonesNow[0].state,
  MilestoneState.earned,
  "the milestone must be settled as earned",
);

console.log(
  "\n" +
    JSON.stringify(
      {
        passed: true,
        agreement: Number(id),
        escrow: escrow.address,
        deposit: formatAmount(deposit),
        workerPaid: formatAmount(workerAmount),
        verifierPaid: formatAmount(verifierFee),
        proven: [
          "three separate accounts signed their own actions",
          "terms hash computed locally matches the contract",
          "an account with no role cannot accept",
          "only the named verifier can approve",
          "approval credits worker and verifier in one transaction",
          "a second approval does not pay twice",
          "a second withdrawal does not pay twice",
          "withdrawn amounts match the agreed allocations exactly",
        ],
      },
      null,
      2,
    ),
);
