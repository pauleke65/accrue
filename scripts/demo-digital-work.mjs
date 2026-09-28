/** Exercise a complete public API job on Monad testnet and the local Jev route. */
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import {
  createPublicClient, createWalletClient, decodeEventLog, getAddress, http, keccak256,
  parseUnits, stringToHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const root = new URL("../", import.meta.url);
const envPath = new URL(".env.local", root);
const varsPath = new URL(".dev.vars", root);
const readVars = (path) => Object.fromEntries(readFileSync(path, "utf8").split("\n")
  .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
  .map((line) => { const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1)]; }));
function putVar(path, key, value) {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

const vars = readVars(varsPath);
const local = readVars(envPath);
const payer = privateKeyToAccount(local.ACCRUE_TESTNET_DEPLOYER_KEY);
const worker = privateKeyToAccount(local.ACCRUE_TESTNET_WORKER_KEY);
const reviewer = privateKeyToAccount(local.ACCRUE_TESTNET_VERIFIER_KEY);
const jev = privateKeyToAccount(vars.ACCRUE_JEV_VERIFIER_KEY);
let reviewerCKey = local.ACCRUE_TESTNET_REVIEWER_C_KEY;
if (!reviewerCKey) {
  reviewerCKey = generatePrivateKey();
  putVar(envPath, "ACCRUE_TESTNET_REVIEWER_C_KEY", reviewerCKey);
}
const reviewerC = privateKeyToAccount(reviewerCKey);
const address = getAddress(local.NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS);
const tokenAddress = "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC";
const artifact = JSON.parse(readFileSync(new URL(
  "contracts/out/AccrueDigitalWork.sol/AccrueDigitalWork.json", root,
), "utf8"));
const tokenAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [
    { name: "spender", type: "address" }, { name: "amount", type: "uint256" },
  ], outputs: [{ type: "bool" }] },
];
const transport = http("https://testnet-rpc.monad.xyz", { timeout: 30_000 });
const publicClient = createPublicClient({ chain: monadTestnet, transport });
const client = (account) => createWalletClient({ account, chain: monadTestnet, transport });
const receipt = async (hash) => {
  const result = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (result.status !== "success") throw new Error(`Testnet transaction reverted: ${hash}`);
  return result;
};
const call = async (account, functionName, args) => receipt(await client(account).writeContract({
  address, abi: artifact.abi, functionName, args,
}));
const post = async (path, body) => {
  const response = await fetch(`http://localhost:5173/api/digital-work/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
};
const policy = {
  title: "Deploy a working REST API",
  brief: "Deploy a public JSON health endpoint and demonstrate that it returns the agreed status and service value.",
  endpointPath: "/health", expectedStatus: 200,
  expectedJsonKey: "status", expectedJsonValue: "ready",
  passThreshold: 0.9, failThreshold: 0.1,
};
const manifest = {
  commitUrl: `https://github.com/pauleke65/accrue/commit/${process.env.ACCRUE_DEMO_COMMIT ?? "5cb48cf69c4ab6f5a20d36ab057923dcf6aef863"}`,
  deploymentUrl: "https://accrue-verifiable-work-demo.pauleke65.workers.dev",
  notes: "Public Cloudflare Worker with a JSON /health endpoint.",
};
const digest = (value) => keccak256(stringToHex(JSON.stringify(value)));
const policyDigest = digest(policy);
const reward = parseUnits("5", 6);
const feePool = parseUnits("0.3", 6);
const now = Math.floor(Date.now() / 1000);
const deadline = BigInt(now + 24 * 3600);
const reviewDeadline = BigInt(now + 48 * 3600);

if (!existsSync(envPath) || !address) throw new Error("Deploy the digital-work contract first.");
const createReceipt = await call(payer, "create", [
  worker.address, [jev.address, reviewer.address, reviewerC.address],
  reward, feePool, deadline, reviewDeadline, policyDigest,
]);
const created = createReceipt.logs.map((log) => {
  try { return decodeEventLog({ abi: artifact.abi, data: log.data, topics: log.topics }); }
  catch { return null; }
}).find((event) => event?.eventName === "JobCreated");
if (!created) throw new Error("JobCreated event missing.");
const onchainId = created.args.id.toString();
const jobId = `10143:${address}:${onchainId}`;
const writeMessage = (action, hash) => `Accrue digital work ${action}\nJob: ${jobId}\nDigest: ${hash}`;
await post("jobs", {
  onchainId, policy, payer: payer.address,
  signature: await payer.signMessage({ message: writeMessage("create", policyDigest) }),
});
await call(worker, "accept", [BigInt(onchainId), policyDigest]);
await receipt(await client(payer).writeContract({
  address: tokenAddress, abi: tokenAbi, functionName: "approve", args: [address, reward + feePool],
}));
await call(payer, "fund", [BigInt(onchainId)]);

const evidenceDigest = digest({ jobId, policyHash: policyDigest, manifest });
await call(worker, "submit", [BigInt(onchainId), evidenceDigest]);
await post("submissions", {
  onchainId, version: 1, manifest, worker: worker.address,
  signature: await worker.signMessage({ message: writeMessage("submit", evidenceDigest) }),
});

const proofs = [{
  address: payer.address,
  signature: await payer.signMessage({ message: `Accrue: show funded jobs for ${payer.address}` }),
}];
const verification = await post("verify", { onchainId, version: 1, proofs });
console.log(JSON.stringify({
  onchainId, contract: address, jobId, createTx: createReceipt.transactionHash,
  worker: worker.address, reviewers: [jev.address, reviewer.address, reviewerC.address],
  policyHash: policyDigest, evidenceHash: evidenceDigest, verification,
}, null, 2));
