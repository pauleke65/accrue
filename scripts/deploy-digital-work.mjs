/** Deploy the testnet digital-work contract and provision a separate Jev voter. */
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const root = new URL("../", import.meta.url);
const localPath = new URL(".env.local", root);
const varsPath = new URL(".dev.vars", root);

function readVars(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split).trim(), line.slice(split + 1).trim()];
    }));
}

function putVar(path, key, value) {
  const source = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = source.split("\n").filter((line) => line.length > 0);
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

const local = readVars(localPath);
const deployerKey = local.ACCRUE_TESTNET_DEPLOYER_KEY;
if (!/^0x[a-fA-F0-9]{64}$/.test(deployerKey ?? ""))
  throw new Error("A testnet deployer key is required in .env.local.");

const vars = readVars(varsPath);
const jevKey = /^0x[a-fA-F0-9]{64}$/.test(vars.ACCRUE_JEV_VERIFIER_KEY ?? "")
  ? vars.ACCRUE_JEV_VERIFIER_KEY : generatePrivateKey();
putVar(varsPath, "ACCRUE_JEV_VERIFIER_KEY", jevKey);
const jev = privateKeyToAccount(jevKey);
const deployer = privateKeyToAccount(deployerKey);
if (jev.address === deployer.address) throw new Error("Jev must use a separate signer.");

const artifact = JSON.parse(readFileSync(new URL(
  "contracts/out/AccrueDigitalWork.sol/AccrueDigitalWork.json", root,
), "utf8"));
const token = "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC";
const transport = http("https://testnet-rpc.monad.xyz", { timeout: 30_000 });
const publicClient = createPublicClient({ chain: monadTestnet, transport });
const walletClient = createWalletClient({ account: deployer, chain: monadTestnet, transport });

let contractAddress = local.NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS;
let deploymentTx = null;
if (!contractAddress) {
  deploymentTx = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [token],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTx, timeout: 120_000 });
  if (receipt.status !== "success" || !receipt.contractAddress)
    throw new Error("Digital-work deployment did not confirm.");
  contractAddress = receipt.contractAddress;
  putVar(localPath, "NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS", contractAddress);
}

const boundToken = await publicClient.readContract({
  address: contractAddress, abi: artifact.abi, functionName: "token",
});
if (boundToken.toLowerCase() !== token.toLowerCase())
  throw new Error("Deployed contract is bound to the wrong token.");

const gas = await publicClient.getBalance({ address: jev.address });
if (gas < 500_000_000_000_000_000n) {
  const hash = await walletClient.sendTransaction({
    to: jev.address,
    value: 500_000_000_000_000_000n - gas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("Jev gas funding did not confirm.");
}

console.log(JSON.stringify({
  contractAddress,
  deploymentTx,
  jevAddress: jev.address,
  jevGas: (await publicClient.getBalance({ address: jev.address })).toString(),
}, null, 2));
