/**
 * The payment directory, against the running local server.
 *
 * The property that matters is not that a tag can be claimed, but that it
 * cannot be claimed for an account the claimant does not control. Both are
 * checked here.
 *
 *   node tests/tags-smoke.mjs
 */
import assert from "node:assert/strict";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const base = process.env.ACCRUE_TEST_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Smoke tests are local-only.");

const auth = await fetch(base + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = auth.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "local sign-in cookie");

const call = async (path, body) => {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      origin: base,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
};

const owner = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const tag = `qa_${Date.now().toString(36)}`.slice(0, 20);
const message = (t, a) => `Accrue: claim the tag @${t} for ${a}`;

// A claim signed by the account it points at is accepted.
const signature = await owner.signMessage({
  message: message(tag, owner.address),
});
let result = await call("/api/tags", {
  tag,
  address: owner.address,
  displayName: "QA account",
  signature,
});
assert.equal(result.status, 201, JSON.stringify(result.data));

// It resolves back to that address.
result = await call(`/api/tags?tag=${tag}`);
assert.equal(result.data.found, true);
assert.equal(result.data.address, owner.address);
assert.equal(result.data.displayName, "QA account");

// And the reverse lookup finds the tag from the address.
result = await call(`/api/tags?address=${owner.address}`);
assert.equal(result.data.found, true);
assert.equal(result.data.tag, tag);

// A claim on somebody else's address, signed by the wrong key, is refused.
const forgedTag = `${tag}x`.slice(0, 20);
const forged = await other.signMessage({
  message: message(forgedTag, owner.address),
});
result = await call("/api/tags", {
  tag: forgedTag,
  address: owner.address,
  signature: forged,
});
assert.equal(result.status, 403, "a signature from another key must be refused");

// A signature for a different tag must not transfer to this one.
const replay = await owner.signMessage({
  message: message("someothertag", owner.address),
});
result = await call("/api/tags", {
  tag: `${tag}y`.slice(0, 20),
  address: owner.address,
  signature: replay,
});
assert.equal(result.status, 403, "a signature for another tag must not replay");

// Someone else cannot take a tag that is already held.
const squatter = await other.signMessage({
  message: message(tag, other.address),
});
result = await call("/api/tags", {
  tag,
  address: other.address,
  signature: squatter,
});
assert.equal(result.status, 409, "an existing tag must not be reassigned");

// Malformed tags are refused before any signature work.
for (const bad of ["ab", "_leading", "trailing_", "Has Space", "a".repeat(40)]) {
  result = await call("/api/tags", {
    tag: bad,
    address: owner.address,
    signature,
  });
  assert.equal(result.status, 400, `"${bad}" must be refused`);
}

// Unauthenticated access is refused.
assert.equal((await fetch(base + `/api/tags?tag=${tag}`)).status, 401);

console.log(
  JSON.stringify(
    {
      passed: true,
      tag,
      checks: [
        "a claim signed by its own account is accepted",
        "the tag resolves to that address",
        "the address resolves back to the tag",
        "a claim signed by another key is refused",
        "a signature for a different tag does not replay",
        "an existing tag cannot be reassigned",
        "malformed tags are refused",
        "unauthenticated access is refused",
      ],
    },
    null,
    2,
  ),
);
