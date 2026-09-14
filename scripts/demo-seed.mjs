/**
 * Stages the app for a demo recording.
 *
 * Filming is hard when every prop has to be built on camera: tags have to
 * exist before anyone can be paid, and a job has to be part-finished before
 * "approve and pay" means anything. This puts three jobs on the network at
 * three different stages and leaves the interesting step un-taken, so the
 * recording can start at the moment worth watching.
 *
 * Everything it creates is real: real accounts, real AUSD, real transactions
 * on Monad testnet. Nothing here fakes a state the contract would not reach.
 *
 * Your passkey accounts are the ones that sign on camera, and this script
 * cannot sign for them — that is the point of a passkey. So pass their
 * addresses and it will make sure they can act: network fees covered, test
 * money in hand. Read them off the role switcher in the app.
 *
 *   node scripts/demo-seed.mjs --fund 0xPayer,0xWorker,0xVerifier
 *   node scripts/demo-seed.mjs           # stage example jobs as well
 *   node scripts/demo-seed.mjs --status  # show what is staged
 */
import { readFileSync, existsSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { readBalance, readGasBalance } from "../lib/ausd.ts";
import {
  callEscrow,
  approveDeposit,
  readAgreement,
  readNextId,
  hashText,
} from "../lib/escrow.ts";
import { escrow, network, parseAmount, formatAmount } from "../lib/chain.ts";

const base = process.env.ACCRUE_TEST_URL ?? "http://localhost:5173";
const statusOnly = process.argv.includes("--status");
const fundFlag = process.argv.indexOf("--fund");
const fundAddresses =
  fundFlag === -1
    ? []
    : (process.argv[fundFlag + 1] ?? "")
        .split(",")
        .map((a) => a.trim())
        .filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a));

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
if (!cookie) throw new Error("The local server must be running.");

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

const say = (step, detail) => console.log(`  ${step.padEnd(26)} ${detail}`);

if (statusOnly) {
  const listed = await api("/api/live-agreements");
  console.log(`\nStaged jobs (${listed.data.agreements.length}):\n`);
  for (const a of listed.data.agreements) {
    const chain = await readAgreement(BigInt(a.onchainId));
    say(
      `#${a.onchainId} ${a.title.slice(0, 22)}`,
      `${chain.funded ? "funded" : "unfunded"} · reserved ${formatAmount(chain.reserved)}`,
    );
  }
  console.log(
    `\n  payer    ${formatAmount(await readBalance(payer.address))} AUSD` +
      `\n  worker   ${formatAmount(await readBalance(worker.address))} AUSD` +
      `\n  verifier ${formatAmount(await readBalance(verifier.address))} AUSD\n`,
  );
  process.exit(0);
}

console.log("\nStaging the demo on " + network.name + "\n");

/* ------------------------------------------- the accounts that sign on camera */

// These belong to a passkey this script cannot use. All it can do is make
// sure they are able to act when the recording starts.
for (const address of fundAddresses) {
  await api("/api/sponsor", { address, action: "gas" });
  await api("/api/sponsor", { address, action: "tokens" });
  say("your account funded", `${address.slice(0, 10)}… ${formatAmount(await readBalance(address))} AUSD`);
}
if (fundAddresses.length)
  console.log(
    "\n  Claim a tag for each of those roles in the app before filming.\n",
  );

/* ------------------------------------------------------ make sure everyone can act */

for (const [name, account] of [
  ["payer", payer],
  ["worker", worker],
  ["verifier", verifier],
]) {
  if ((await readGasBalance(account.address)) === 0n)
    await api("/api/sponsor", { address: account.address, action: "gas" });
  if ((await readBalance(account.address)) < parseAmount("100"))
    await api("/api/sponsor", { address: account.address, action: "tokens" });
  say(`${name} ready`, `${formatAmount(await readBalance(account.address))} AUSD`);
}

/* ------------------------------------------------------------------------- tags */

const tags = [
  ["bola", worker, "Bola — builder"],
  ["ngozi", verifier, "Ngozi — site engineer"],
  ["amara", payer, "Amara — paying from London"],
];
for (const [tag, account, displayName] of tags) {
  const signature = await account.signMessage({
    message: `Accrue: claim the tag @${tag} for ${account.address}`,
  });
  const result = await api("/api/tags", {
    tag,
    address: account.address,
    displayName,
    signature,
  });
  // A tag already claimed by the same account is fine; anything else is not.
  if (result.status !== 201 && result.status !== 409)
    throw new Error(`Could not claim @${tag}: ${JSON.stringify(result.data)}`);
  say(`@${tag}`, displayName);
}

/* --------------------------------------------------------------------- the jobs */

const scope =
  "Renovate the ground floor of the Lekki house. Materials included; furniture excluded.";

async function stage({ title, milestones, upTo }) {
  const id = await readNextId();
  const onChain = milestones.map((m) => ({
    workerAmount: parseAmount(m.amount),
    verifierFee: parseAmount(m.fee),
    externalVerifier: true,
    criteriaHash: hashText(m.criteria),
  }));
  const deposit = onChain.reduce(
    (sum, m) => sum + m.workerAmount + m.verifierFee,
    0n,
  );

  let state = await callEscrow({
    account: payer,
    functionName: "create",
    args: [
      worker.address,
      verifier.address,
      BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400),
      hashText(scope),
      onChain,
    ],
  });
  if (state.status !== "confirmed") throw new Error("create failed");

  await api("/api/live-agreements", {
    chainId: network.chainId,
    escrow: escrow.address,
    onchainId: id.toString(),
    title,
    scope,
    payer: payer.address,
    worker: worker.address,
    verifier: verifier.address,
    workerTag: "bola",
    verifierTag: "ngozi",
    milestones: milestones.map((m, i) => ({
      title: m.title,
      criteria: m.criteria,
      criteriaHash: onChain[i].criteriaHash,
      workerAmount: onChain[i].workerAmount.toString(),
      verifierFee: onChain[i].verifierFee.toString(),
    })),
  });

  if (upTo === "created") {
    say(title, `#${id} · awaiting acceptance`);
    return id;
  }

  const agreement = await readAgreement(id);
  for (const account of [worker, verifier])
    await callEscrow({
      account,
      functionName: "accept",
      args: [id, agreement.termsHash],
    });

  if (upTo === "accepted") {
    say(title, `#${id} · accepted, awaiting funding`);
    return id;
  }

  await approveDeposit({ account: payer, amount: deposit });
  await callEscrow({ account: payer, functionName: "fund", args: [id] });

  if (upTo === "funded") {
    say(title, `#${id} · funded ${formatAmount(deposit)} AUSD`);
    return id;
  }

  const evidence = hashText(milestones[0].evidence ?? "Work completed.");
  await callEscrow({
    account: worker,
    functionName: "submitEvidence",
    args: [id, 0n, evidence],
  });

  if (upTo === "submitted") {
    say(title, `#${id} · awaiting the verifier — the shot`);
    return id;
  }

  await callEscrow({
    account: verifier,
    functionName: "approve",
    args: [id, 0n, evidence],
  });
  say(title, `#${id} · first milestone paid`);
  return id;
}

console.log("");

// Three jobs at three stages, so the recording can show a whole lifecycle
// without waiting for any of it.
await stage({
  title: "Lekki house — ground floor",
  upTo: "submitted",
  milestones: [
    {
      title: "Foundation and damp course",
      criteria:
        "Foundation poured and cured 72 hours. Damp-proof course laid. Level within 5mm across the slab.",
      amount: "120.00",
      fee: "8.00",
      evidence: "Poured on the 9th, cured to the 12th. Photos attached.",
    },
    {
      title: "Block work to lintel height",
      criteria: "Walls to lintel height, plumb within 3mm per metre.",
      amount: "150.00",
      fee: "10.00",
    },
  ],
});

await stage({
  title: "Roof repair — Surulere",
  upTo: "funded",
  milestones: [
    {
      title: "Strip and replace sheeting",
      criteria: "Old sheeting removed, replaced, no daylight visible from inside.",
      amount: "80.00",
      fee: "6.00",
    },
  ],
});

await stage({
  title: "Kitchen fit-out — Yaba",
  upTo: "created",
  milestones: [
    {
      title: "Cabinets and worktop",
      criteria: "Units fitted level, worktop sealed, doors aligned within 2mm.",
      amount: "95.00",
      fee: "7.00",
    },
  ],
});

console.log(
  "\nStaged. Sign in with your passkey, then:\n" +
    "  · as the verifier, approve the Lekki foundation — money moves on camera\n" +
    "  · as the payer, fund the Surulere roof\n" +
    "  · as the worker, accept the Yaba kitchen\n" +
    "\nRun with --status to see the current state.\n",
);
