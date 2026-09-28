/** Retry Jev on an existing submitted demo job after a provider key is configured. */
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";

const id = process.argv[2] ?? "2";
const local = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter((line) => line.includes("=") && !line.startsWith("#"))
  .map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
const payer = privateKeyToAccount(local.ACCRUE_TESTNET_DEPLOYER_KEY);
const proof = {
  address: payer.address,
  signature: await payer.signMessage({
    message: `Accrue: show funded jobs for ${payer.address}`,
  }),
};
const response = await fetch("http://localhost:5173/api/digital-work/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ onchainId: id, version: 1, proofs: [proof] }),
});
const result = await response.json();
console.log(JSON.stringify({ status: response.status, result }, null, 2));
if (!response.ok) process.exitCode = 1;
