/**
 * Gas sponsorship, against the running local server and the live testnet.
 *
 * The case that matters is the one every new account starts in: zero MON and
 * zero tokens. If that account cannot claim test money and cannot send, the
 * product is asking people to go and find a gas faucet first — which is the
 * plumbing this is meant to hide.
 *
 *   node tests/sponsor-smoke.mjs
 */
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readBalance, readGasBalance } from "../lib/ausd.ts";
import { formatAmount } from "../lib/chain.ts";

const base = process.env.ACCRUE_TEST_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Smoke tests are local-only.");

const auth = await fetch(base + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = auth.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "local sign-in cookie");

const sponsor = async (address, action) => {
  const response = await fetch(base + "/api/sponsor", {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: JSON.stringify({ address, action }),
  });
  return { status: response.status, data: await response.json() };
};

// Unauthenticated callers get nothing.
assert.equal(
  (
    await fetch(base + "/api/sponsor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "0x" + "1".repeat(40), action: "gas" }),
    })
  ).status,
  401,
);

// A malformed address is refused before any transaction is attempted.
assert.equal((await sponsor("not-an-address", "gas")).status, 400);

const fresh = privateKeyToAccount(generatePrivateKey()).address;
assert.equal(await readGasBalance(fresh), 0n, "a fresh account holds no MON");
assert.equal(await readBalance(fresh), 0n, "a fresh account holds no tokens");

// Test money must be claimable with no gas at all.
const tokens = await sponsor(fresh, "tokens");
assert.equal(tokens.status, 200, JSON.stringify(tokens.data));
const balance = await readBalance(fresh);
assert.ok(balance > 0n, "the account must actually receive tokens");

// And the account must end up able to pay its own way afterwards.
const gas = await sponsor(fresh, "gas");
assert.equal(gas.status, 200, JSON.stringify(gas.data));
const funded = await readGasBalance(fresh);
assert.ok(funded > 0n, "the account must actually receive MON");

// A second grant is refused rather than repeatedly draining the sponsor.
const again = await sponsor(fresh, "gas");
assert.equal(again.status, 200);
assert.equal(again.data.skipped, true, "a funded account must not be topped up");
assert.equal(
  await readGasBalance(fresh),
  funded,
  "a skipped grant must not move anything",
);

console.log(
  JSON.stringify(
    {
      passed: true,
      account: fresh,
      received: `${formatAmount(balance)} AUSD`,
      gas: `${(Number(funded) / 1e18).toFixed(4)} MON`,
      checks: [
        "unauthenticated sponsorship is refused",
        "a malformed address is refused",
        "an account with nothing can claim test money",
        "an account with nothing can be funded for fees",
        "a funded account is not topped up again",
      ],
    },
    null,
    2,
  ),
);
