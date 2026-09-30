/**
 * Deploy the v2 contracts (pay-on-silence, cancellation, review window) to
 * Monad testnet.
 *
 *   cd contracts && forge build && forge test && cd ..
 *   node scripts/deploy-v2.mjs            # shows the plan, sends nothing
 *   node scripts/deploy-v2.mjs --confirm  # deploys both contracts
 *
 * Uses ACCRUE_TESTNET_DEPLOYER_KEY from .env.local. After deploying it checks
 * each contract is bound to AUSD and reports rulesVersion() == 2, tops up the
 * Proof Engine verifier's gas, and prints the settings to change. It never
 * edits env files itself: switching the app over is a deliberate step.
 *
 * Existing jobs are not moved. They stay on the v1 contracts, and the app
 * keeps reading and acting on each job at the contract it was created on.
 */
import { existsSync, readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const AUSD = "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC";
const V1 = {
  escrow: "0xf8c44A529cd0470597C7865d2B2473abff65d0De",
  digital: "0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07",
};
const JEV_GAS = 500_000_000_000_000_000n; // 0.5 MON
const confirm = process.argv.includes("--confirm");
const root = new URL("../", import.meta.url);

function readVars(file) {
  const path = new URL(file, root);
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]));
}

function artifact(name) {
  const path = new URL(`contracts/out/${name}.sol/${name}.json`, root);
  if (!existsSync(path)) throw new Error(`Missing ${name} build. Run "cd contracts && forge build" first.`);
  const json = JSON.parse(readFileSync(path, "utf8"));
  if (!json.abi.some((e) => e.name === "rulesVersion"))
    throw new Error(`${name} build is not v2 (no rulesVersion). Rebuild from this branch.`);
  return json;
}

const local = readVars(".env.local");
const vars = readVars(".dev.vars");
const deployerKey = local.ACCRUE_TESTNET_DEPLOYER_KEY;
if (!/^0x[a-fA-F0-9]{64}$/.test(deployerKey ?? "")) throw new Error("ACCRUE_TESTNET_DEPLOYER_KEY is missing from .env.local.");
const deployer = privateKeyToAccount(deployerKey);
const jevKey = vars.ACCRUE_JEV_VERIFIER_KEY;
const jev = /^0x[a-fA-F0-9]{64}$/.test(jevKey ?? "") ? privateKeyToAccount(jevKey) : null;

const transport = http("https://testnet-rpc.monad.xyz", { timeout: 30_000 });
const publicClient = createPublicClient({ chain: monadTestnet, transport });
const walletClient = createWalletClient({ account: deployer, chain: monadTestnet, transport });

const escrowArtifact = artifact("AccrueEscrow");
const digitalArtifact = artifact("AccrueDigitalWork");
const balance = await publicClient.getBalance({ address: deployer.address });

console.log(`Deployer ${deployer.address}: ${formatEther(balance)} MON`);
console.log(`Token (AUSD) ${AUSD}`);
console.log(`Proof Engine verifier ${jev ? jev.address : "not configured in .dev.vars"}`);
if (!confirm) {
  console.log("\nPlan: deploy AccrueEscrow v2 and AccrueDigitalWork v2, check both, top up the verifier to 0.5 MON.");
  console.log("Nothing sent. Run again with --confirm to deploy.");
  process.exit(0);
}
if (balance < 2n * 10n ** 18n) throw new Error("Deployer has under 2 MON; fund it at https://faucet.monad.xyz first.");

async function deploy(name, json) {
  const hash = await walletClient.deployContract({ abi: json.abi, bytecode: json.bytecode.object, args: [AUSD] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deployment did not confirm.`);
  const address = receipt.contractAddress;
  const [token, rules] = await Promise.all([
    publicClient.readContract({ address, abi: json.abi, functionName: "token" }),
    publicClient.readContract({ address, abi: json.abi, functionName: "rulesVersion" }),
  ]);
  if (token.toLowerCase() !== AUSD.toLowerCase()) throw new Error(`${name} is bound to the wrong token.`);
  if (rules !== 2n) throw new Error(`${name} reports rulesVersion ${rules}, expected 2.`);
  console.log(`${name} v2: ${address} (block ${receipt.blockNumber}, tx ${hash})`);
  return address;
}

const escrow = await deploy("AccrueEscrow", escrowArtifact);
const digital = await deploy("AccrueDigitalWork", digitalArtifact);

if (jev) {
  const gas = await publicClient.getBalance({ address: jev.address });
  if (gas < JEV_GAS) {
    const hash = await walletClient.sendTransaction({ to: jev.address, value: JEV_GAS - gas });
    await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  }
  console.log(`Proof Engine verifier gas: ${formatEther(await publicClient.getBalance({ address: jev.address }))} MON`);
}

console.log(`
Set these where the app is built (.env.local for local dev; the build
environment for Cloudflare), then rebuild and redeploy the app:

NEXT_PUBLIC_ACCRUE_ESCROW_ADDRESS=${escrow}
NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS=${digital}
NEXT_PUBLIC_ACCRUE_LEGACY_CONTRACTS=${V1.escrow},${V1.digital}
`);
