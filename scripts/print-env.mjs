/**
 * Prints this machine's configuration for a deployment.
 *
 * Values are read locally and written to your terminal. Nothing is sent
 * anywhere. Treat the output as secret: ACCRUE_SPONSOR_KEY is a private key,
 * and anyone holding it can spend the account it belongs to.
 *
 *   node scripts/print-env.mjs            names, sources and whether each is set
 *   node scripts/print-env.mjs --reveal   the values, for pasting into a
 *                                         secrets manager
 */
import { readFileSync, existsSync } from "node:fs";

const reveal = process.argv.includes("--reveal");

const read = (file) => {
  const path = new URL(`../${file}`, import.meta.url).pathname;
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l.slice(l.indexOf("=") + 1).trim(),
      ]),
  );
};

const local = { ...read(".env.local"), ...read(".dev.vars") };

const wanted = [
  {
    name: "ACCRUE_SPONSOR_KEY",
    secret: true,
    does: "Pays a new account's first network fee and claims its test AUSD",
    from: "A funded Monad testnet private key — use a separate one from the deployer",
  },
  {
    name: "ENVIO_API_TOKEN",
    secret: true,
    does: "Payment history across the whole chain",
    from: "https://app.envio.dev/api-tokens",
  },
  {
    name: "ENVIO_RPC_TOKEN",
    secret: true,
    does: "Range reads the public RPC refuses",
    from: "https://app.envio.dev/api-tokens",
  },
  {
    name: "AGORA_API_KEY",
    secret: true,
    does: "Cash-out to a bank through Agora routes",
    from: "https://app.agora.finance → API keys",
  },
];

const mask = (value) =>
  value.length <= 10
    ? "********"
    : `${value.slice(0, 6)}…${value.slice(-4)} (${value.length} chars)`;

console.log("\nDeployment configuration\n");

for (const item of wanted) {
  const value = local[item.name];
  const state = value ? (reveal ? value : mask(value)) : "not set";
  console.log(`  ${item.name}`);
  console.log(`    ${item.does}`);
  console.log(`    ${value ? "set locally: " : "missing — "}${value ? state : item.from}`);
  console.log("");
}

if (!reveal) {
  console.log("  Run with --reveal to print the values.\n");
} else {
  console.log("  Everything above is secret. Do not paste it anywhere public.\n");
  console.log("  Cloudflare:");
  for (const item of wanted)
    if (local[item.name])
      console.log(`    wrangler secret put ${item.name}`);
  console.log("");
}

// The sponsor key doubles as the demo deployer on this machine, which is
// convenient locally and a bad idea in a deployment.
if (local.ACCRUE_SPONSOR_KEY && local.ACCRUE_SPONSOR_KEY === local.ACCRUE_TESTNET_DEPLOYER_KEY)
  console.log(
    "  Note: the sponsor key is the same key that deployed the contract and\n" +
      "  holds the demo funds. For anything shared, generate a separate sponsor\n" +
      "  key and fund it with only what a demo needs.\n",
  );
