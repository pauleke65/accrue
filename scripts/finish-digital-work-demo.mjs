/** Cast two independent review votes and withdraw earned AUSD for a demo job. */
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, getAddress, http, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const id = BigInt(process.argv[2] ?? "1");
const root = new URL("../", import.meta.url);
const variables = Object.fromEntries(readFileSync(new URL(".env.local", root), "utf8")
  .split("\n").filter((line) => line.includes("=") && !line.startsWith("#"))
  .map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
const address = getAddress(variables.NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS);
const abi = JSON.parse(readFileSync(new URL(
  "contracts/out/AccrueDigitalWork.sol/AccrueDigitalWork.json", root,
), "utf8")).abi;
const payer = privateKeyToAccount(variables.ACCRUE_TESTNET_DEPLOYER_KEY);
const worker = privateKeyToAccount(variables.ACCRUE_TESTNET_WORKER_KEY);
const reviewerB = privateKeyToAccount(variables.ACCRUE_TESTNET_VERIFIER_KEY);
const reviewerC = privateKeyToAccount(variables.ACCRUE_TESTNET_REVIEWER_C_KEY);
const transport = http("https://rpc-testnet.monadinfra.com", { timeout: 30_000 });
const publicClient = createPublicClient({ chain: monadTestnet, transport });
const client = (account) => createWalletClient({ chain: monadTestnet, account, transport });
const transact = async (account, functionName, args) => {
  const hash = await client(account).writeContract({ address, abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted: ${hash}`);
  return hash;
};
const post = async (body) => {
  const response = await fetch("http://localhost:5173/api/digital-work/manual-votes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Review metadata: ${response.status} ${JSON.stringify(result)}`);
};
const jobId = `10143:${address}:${id}`;
const job = await publicClient.readContract({ address, abi, functionName: "getJob", args: [id] });
if (job.status !== 2) throw new Error(`Expected a submitted job; status=${job.status}`);

const reviewers = [reviewerB, reviewerC];
const votes = [];
for (const account of reviewers) {
  const gas = await publicClient.getBalance({ address: account.address });
  if (gas < 2_000_000_000_000_000_000n) {
    const topup = await client(payer).sendTransaction({
      to: account.address, value: 2_000_000_000_000_000_000n - gas,
    });
    const topupReceipt = await publicClient.waitForTransactionReceipt({ hash: topup, timeout: 120_000 });
    if (topupReceipt.status !== "success") throw new Error("Reviewer gas top-up reverted.");
  }
  const notes = "Public commit exists. The deployed /health endpoint returns HTTP 200 and status ready.";
  const reportHash = keccak256(stringToHex(JSON.stringify({
    jobId, version: job.version, evidenceHash: job.evidenceHash,
    verifier: account.address, pass: true, notes,
  })));
  const prior = await publicClient.readContract({
    address, abi, functionName: "votes", args: [id, account.address],
  });
  const tx = prior[0] === job.version ? null
    : await transact(account, "vote", [id, job.evidenceHash, true, reportHash]);
  const signature = await account.signMessage({
    message: `Accrue digital work vote\nJob: ${jobId}\nDigest: ${reportHash}`,
  });
  await post({
    onchainId: id.toString(), version: job.version, evidenceHash: job.evidenceHash,
    verifier: account.address, pass: true, notes, signature,
  });
  votes.push({ verifier: account.address, tx, reportHash });
}

const settled = await publicClient.readContract({ address, abi, functionName: "getJob", args: [id] });
const withdrawals = [];
for (const account of [worker, reviewerB, reviewerC, payer]) {
  const amount = await publicClient.readContract({
    address, abi, functionName: "claimable", args: [account.address],
  });
  if (amount > 0n) {
    const tx = await transact(account, "withdraw", []);
    withdrawals.push({ address: account.address, amount: amount.toString(), tx });
  }
}
console.log(JSON.stringify({
  contract: address, onchainId: id.toString(), status: settled.status,
  passVotes: settled.passVotes, votes, withdrawals,
}, null, 2));
