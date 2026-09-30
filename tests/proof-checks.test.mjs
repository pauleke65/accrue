import test from "node:test";
import assert from "node:assert/strict";
import { runChecks, checkItems } from "../lib/proof-checks.ts";
import { parseDigitalManifest, parseDigitalPolicy, policyHash } from "../lib/digital-work-policy.ts";

const base = { passThreshold: 0.9, failThreshold: 0.1 };
const webpage = parseDigitalPolicy({ ...base, type: "webpage", title: "Landing copy", brief: "Publish the new landing page copy.", requiredText: "Pay when it's proven done" });
const pr = parseDigitalPolicy({ ...base, type: "pull_request", title: "Fix checkout", brief: "Fix the mobile checkout bug and get it merged.", repository: "acme/shop" });

/** A fetch that answers from a table, so no test touches the network. */
const fakeFetch = (routes) => async (url) => {
  const hit = routes[String(url)];
  if (!hit) return new Response("not found", { status: 404 });
  return new Response(typeof hit.body === "string" ? hit.body : JSON.stringify(hit.body), { status: hit.status ?? 200 });
};

test("web page passes when it loads and contains the phrase, even split by tags", async () => {
  const manifest = parseDigitalManifest({ pageUrl: "https://acme.com/", notes: "" });
  const fetcher = fakeFetch({ "https://acme.com/": { body: "<h1>Pay when it's <em>proven</em> done</h1>" } });
  const report = await runChecks(webpage, manifest, fetcher);
  assert.deepEqual(checkItems(report).map((i) => i.passed), [true, true]);
});

test("web page fails when the phrase is missing", async () => {
  const manifest = parseDigitalManifest({ pageUrl: "https://acme.com/", notes: "" });
  const report = await runChecks(webpage, manifest, fakeFetch({ "https://acme.com/": { body: "<p>Coming soon</p>" } }));
  assert.deepEqual(checkItems(report).map((i) => i.passed), [true, false]);
});

test("pull request passes only when merged into the agreed repository", async () => {
  const manifest = parseDigitalManifest({ pullRequestUrl: "https://github.com/acme/shop/pull/42", notes: "" });
  const api = "https://api.github.com/repos/acme/shop/pulls/42";
  const merged = await runChecks(pr, manifest, fakeFetch({ [api]: { body: { merged: true, base: { repo: { full_name: "acme/shop" } } } } }));
  assert.deepEqual(checkItems(merged).map((i) => i.passed), [true, true, true]);
  const open = await runChecks(pr, manifest, fakeFetch({ [api]: { body: { merged: false, base: { repo: { full_name: "acme/shop" } } } } }));
  assert.equal(checkItems(open).find((i) => i.label === "Merged").passed, false);
});

test("a pull request into a fork does not count", async () => {
  const manifest = parseDigitalManifest({ pullRequestUrl: "https://github.com/someone/shop/pull/7", notes: "" });
  const api = "https://api.github.com/repos/someone/shop/pulls/7";
  const report = await runChecks(pr, manifest, fakeFetch({ [api]: { body: { merged: true, base: { repo: { full_name: "someone/shop" } } } } }));
  assert.equal(checkItems(report).find((i) => i.label === "Target repository").passed, false);
});

test("evidence of the wrong kind is refused", async () => {
  const manifest = parseDigitalManifest({ pageUrl: "https://acme.com/", notes: "" });
  await assert.rejects(runChecks(pr, manifest, fakeFetch({})), /not the kind of deliverable/);
});

test("page URLs must be public HTTPS names", () => {
  for (const pageUrl of ["http://acme.com/", "https://localhost/", "https://127.0.0.1/", "https://user:pw@acme.com/", "https://acme.com:8443/"])
    assert.throws(() => parseDigitalManifest({ pageUrl, notes: "" }), undefined, pageUrl);
});

test("the original API policy format still hashes as before", () => {
  // Same policy as the builder's old default; the hash below was produced by
  // the pre-change code, and live jobs depend on it staying identical.
  const policy = { title: "Build a REST API endpoint", brief: "Build and deploy a public API endpoint that returns the agreed JSON response.", endpointPath: "/api/health", expectedStatus: 200, expectedJsonKey: "ok", expectedJsonValue: "true", ...base };
  assert.equal(policyHash(policy), EXPECTED_API_HASH);
});

const EXPECTED_API_HASH = "0xa72a6bb57a7d677630f1a40e70d78bc37e53a4332c2e26229d8d28bee2bdbe2f";
