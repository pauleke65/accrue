/**
 * Creates or reads the local testnet deployer account.
 *
 * The key is written to .env.local, which is gitignored, and is never printed.
 * It exists to deploy the escrow to Monad testnet and to exercise live
 * transfers; it holds testnet value only and must never be reused anywhere
 * that real funds can reach.
 *
 *   node scripts/deployer.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { publicClient } from "../lib/ausd.ts";
import { network, token, formatAmount, explorer } from "../lib/chain.ts";
import { readBalance } from "../lib/ausd.ts";

const ENV = new URL("../.env.local", import.meta.url).pathname;
const KEY = "ACCRUE_TESTNET_DEPLOYER_KEY";

function readEnv() {
  if (!existsSync(ENV)) return {};
  return Object.fromEntries(
    readFileSync(ENV, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const env = readEnv();
let privateKey = env[KEY];
let created = false;

if (!privateKey) {
  privateKey = generatePrivateKey();
  env[KEY] = privateKey;
  writeFileSync(
    ENV,
    `# Local testnet only. Never reuse this key where real funds can reach it.\n` +
      Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") +
      "\n",
    { mode: 0o600 },
  );
  created = true;
}

const account = privateKeyToAccount(privateKey);
const gas = await publicClient().getBalance({ address: account.address });
const ausd = await readBalance(account.address);

console.log(
  JSON.stringify(
    {
      created,
      address: account.address,
      network: network.name,
      chainId: network.chainId,
      gas: `${(Number(gas) / 1e18).toFixed(4)} MON`,
      ausd: `${formatAmount(ausd)} ${token.symbol}`,
      explorer: explorer.address(account.address),
      needsGas: gas === 0n,
      gasFaucet: network.gasFaucet,
    },
    null,
    2,
  ),
);

if (gas === 0n) {
  console.log(
    `\nFund this address with testnet MON at ${network.gasFaucet} before deploying.\n` +
      `AUSD does not need the faucet site: the account can drip its own from Agora once it has gas.`,
  );
}
