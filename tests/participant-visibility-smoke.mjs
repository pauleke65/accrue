/**
 * A genuine participant can see a job someone else's account created.
 *
 * live_agreements rows are written by whoever calls create() — the payer.
 * Before this fix, the worker and verifier named in that job had no way to
 * read its title, scope, or criteria back: their own account never wrote
 * that row, so their own GET /api/live-agreements returned nothing for a
 * job they can genuinely sign transactions on. This proves the fix, and
 * proves it does not simply open every row to everyone.
 *
 * Local dev auth is pinned to one synthetic identity (see
 * build/sites-vite-plugin.ts), so two real accounts cannot be produced by
 * signing in twice. A foreign owner is simulated instead: a row inserted
 * directly into local D1 under an owner value this session did not create,
 * naming a worker address this script holds the private key for. That is a
 * more precise test than two real accounts would be — it proves the query
 * does not filter by session owner at all for a correctly proven address,
 * rather than merely proving two real sessions happen to agree.
 *
 *   node tests/participant-visibility-smoke.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { participantProofMessage } from "../lib/participant-proof.ts";

const base = process.env.ACCRUE_TEST_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Smoke tests are local-only.");

const auth = await fetch(base + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = auth.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "local sign-in cookie");

const api = async (path, proofs) => {
  const query = proofs
    ? `?proofs=${encodeURIComponent(JSON.stringify(proofs))}`
    : "";
  const response = await fetch(base + path + query, { headers: { cookie } });
  return { status: response.status, data: await response.json() };
};

const d1 = (sql) =>
  execFileSync(
    process.execPath,
    [
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--command",
      sql,
    ],
    { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
  );

const say = (step, detail) => console.log(`  ${step.padEnd(30)} ${detail}`);

const stranger = privateKeyToAccount(generatePrivateKey());
const impostor = privateKeyToAccount(generatePrivateKey());
const otherOwner = `someone_elses_account_${Date.now().toString(36)}`;
const onchainId = String(Date.now());
const rowId = `10143:0x0000000000000000000000000000000000dEaD:${onchainId}`;
const title = "A job this session did not create";

// A row exactly like a real payer would write, but under a different owner
// entirely — the exact scenario the fix addresses.
const escaped = (s) => s.replace(/'/g, "''");
d1(
  `INSERT INTO live_agreements` +
    `(id,owner,chain_id,escrow,onchain_id,title,scope,payer_address,worker_address,verifier_address,worker_tag,verifier_tag,milestones,created_at)` +
    ` VALUES(` +
    `'${escaped(rowId)}','${escaped(otherOwner)}',10143,` +
    `'0x0000000000000000000000000000000000dEaD','${escaped(onchainId)}',` +
    `'${escaped(title)}','A job created by an account this session is not signed into.',` +
    `'0x0000000000000000000000000000000000dEaD','${stranger.address}','0x0000000000000000000000000000000000dEaD',` +
    `null,null,'[]','${new Date().toISOString()}')`,
);
say("row inserted", `owner=${otherOwner}, worker=${stranger.address.slice(0, 10)}…`);

try {
  // Before proving control of the worker address, the foreign row must be
  // invisible — this session's own owner-scoped view is unaffected.
  const before = await api("/api/live-agreements");
  assert.equal(before.status, 200);
  assert.ok(
    !before.data.agreements.some((a) => a.id === rowId),
    "a foreign row must not be visible before any proof is given",
  );
  say("invisible without proof", "confirmed");

  // A signature from an unrelated key must not unlock it either — proving
  // control of *an* address is not the same as proving control of *this*
  // agreement's worker address.
  const wrongSignature = await impostor.signMessage({
    message: participantProofMessage(stranger.address),
  });
  const wrongProof = await api("/api/live-agreements", [
    { address: stranger.address, signature: wrongSignature },
  ]);
  assert.equal(wrongProof.status, 200);
  assert.ok(
    !wrongProof.data.agreements.some((a) => a.id === rowId),
    "a mismatched signature must not unlock the row",
  );
  say("invisible with wrong signature", "confirmed");

  // The real proof: the worker's own key signs the exact message the server
  // checks against the exact address the agreement names.
  const validSignature = await stranger.signMessage({
    message: participantProofMessage(stranger.address),
  });
  const proven = await api("/api/live-agreements", [
    { address: stranger.address, signature: validSignature },
  ]);
  assert.equal(proven.status, 200);
  const found = proven.data.agreements.find((a) => a.id === rowId);
  assert.ok(found, "a proven participant must see the foreign row");
  assert.equal(found.title, title);
  assert.equal(found.worker.toLowerCase(), stranger.address.toLowerCase());
  say("visible with valid proof", `title reads correctly: "${found.title}"`);

  // The activity endpoint shares the same access function; confirm it
  // accepts the same proof shape without error rather than re-deriving the
  // whole check against real on-chain events.
  const activity = await api("/api/escrow-activity", [
    { address: stranger.address, signature: validSignature },
  ]);
  assert.equal(activity.status, 200);
  assert.equal(activity.data.configured, true);
  say("escrow-activity accepts the same proof", "no error");

  console.log(
    "\n" +
      JSON.stringify(
        {
          passed: true,
          checks: [
            "a row owned by a different account is invisible with no proof",
            "a signature from the wrong key does not unlock it",
            "a valid signature from the named worker's own key does unlock it",
            "the unlocked row's readable text is correct",
            "escrow-activity accepts the same proof shape",
          ],
        },
        null,
        2,
      ),
  );
} finally {
  d1(`DELETE FROM live_agreements WHERE id = '${escaped(rowId)}'`);
}
