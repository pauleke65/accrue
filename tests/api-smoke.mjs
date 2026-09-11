import assert from "node:assert/strict";
const base = process.env.ACCRUE_TEST_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Smoke tests are local-only.");
const auth = await fetch(base + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = auth.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "Local sign-in cookie");
const request = async (path, body, extra = {}) => {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      origin: base,
      ...(body ? { "content-type": "application/json" } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch {
        return { error: text };
      }
    }),
  };
};
assert.equal((await fetch(base + "/api/agreements")).status, 401);
let result = await request("/api/agreements", {
  operationId: crypto.randomUUID(),
  title: "[API TEST] Renovation",
  scope: "Validate a complete persistent workflow",
  earner: "Test worker",
  verifier: "Test verifier",
  expiry: new Date(Date.now() + 86400000).toISOString(),
  milestones: [
    {
      title: "Foundation",
      criteria: "Evidence meets all accepted criteria",
      amount: 10000,
      fee: 300,
      approver: "verifier",
    },
    {
      title: "Finishing",
      criteria: "Finishing meets the specification",
      amount: 20000,
      fee: 600,
      approver: "verifier",
    },
  ],
});
assert.equal(result.status, 201, JSON.stringify(result.data));
let a = result.data.agreement;
async function act(type, role, extras = {}) {
  const response = await request("/api/agreements/" + a.id, {
    type,
    role,
    version: a.version,
    operationId: crypto.randomUUID(),
    ...extras,
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  a = response.data.agreement;
  return a;
}
assert.equal(
  (
    await request(
      "/api/agreements/" + a.id,
      {
        type: "accept",
        role: "earner",
        version: a.version,
        operationId: crypto.randomUUID(),
      },
      { origin: "https://evil.invalid" },
    )
  ).status,
  403,
);
await act("accept", "earner");
await act("accept", "verifier");
await act("fund", "payer");
const form = new FormData();
form.set("agreementId", a.id);
form.set(
  "file",
  new File(
    ["Synthetic inspection report: all criteria satisfied."],
    "inspection.txt",
    { type: "text/plain" },
  ),
);
const uploaded = await fetch(base + "/api/evidence", {
  method: "POST",
  headers: { cookie, origin: base },
  body: form,
});
assert.equal(uploaded.status, 200);
const file = await uploaded.json();
assert.equal((await fetch(base + "/api/evidence?id=" + file.id)).status, 401);
assert.equal(
  (await fetch(base + "/api/evidence?id=" + file.id, { headers: { cookie } }))
    .status,
  200,
);
await act("submit", "earner", {
  milestone: 0,
  notes: "Materials delivered and checked.",
  files: [file.id],
});
await act("changes", "verifier", {
  milestone: 0,
  notes: "Add the dated receipt.",
});
await act("submit", "earner", {
  milestone: 0,
  notes: "Dated receipt included.",
  files: [file.id],
});
const operation = {
  type: "approve",
  role: "verifier",
  version: a.version,
  operationId: crypto.randomUUID(),
  milestone: 0,
  digest: a.milestones[0].evidence.at(-1).digest,
};
const concurrent = await Promise.all([
  request("/api/agreements/" + a.id, operation),
  request("/api/agreements/" + a.id, {
    ...operation,
    operationId: crypto.randomUUID(),
  }),
]);
assert.equal(
  concurrent.filter((r) => r.status === 200).length,
  1,
  "Exactly one concurrent approval succeeds",
);
assert.equal(
  concurrent.filter((r) => r.status === 409).length,
  1,
  "The racing approval is rejected",
);
a = concurrent.find((r) => r.status === 200).data.agreement;
assert.equal(a.earned.earner, 10000);
assert.equal(a.earned.verifier, 300);
await act("withdraw", "earner");
await act("correct", "verifier", {
  milestone: 0,
  notes: "Receipt date clarified.",
});
await act("cancel", "payer");
await act("cancel", "earner");
await act("cancel", "verifier");
await act("refund", "payer");
await act("withdraw", "verifier");
assert.equal(a.status, "complete");
assert.equal(a.refunded, 20600);
const refreshed = await request("/api/agreements");
const saved = refreshed.data.agreements.find((item) => item.id === a.id);
assert.deepEqual(saved, a);
console.log(
  JSON.stringify(
    {
      passed: true,
      agreementId: a.id,
      checks: [
        "authentication",
        "cross-origin rejection",
        "acceptance",
        "funding",
        "R2 upload and authorized download",
        "resubmission",
        "concurrent approval conflict",
        "atomic allocation",
        "withdrawal",
        "correction",
        "mutual cancellation",
        "protected refund",
        "persistent reload",
      ],
    },
    null,
    2,
  ),
);
