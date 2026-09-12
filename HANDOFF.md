# Accrue — product and engineering handoff

Prepared 11 September 2026, updated 12 September 2026 after the sandbox-stabilisation pass. This document describes the actual checkpoint, not the intended finished product.

## 1. Where we are

**Built:** a local, persistent, three-role milestone-payment sandbox and a separately tested Solidity escrow.

**Not built yet:** the live, multi-user, wallet-connected product required for the full PRD and a credible sponsor-integrated hackathon submission.

The website and contract are **not connected**. The website records simulated USD-cent balances in D1. The contract has not been deployed to Monad. No real funds have moved. No sponsor integration is active. No published URL has been verified.

The intended destination remains Accrue for **Track 2 — Consumer Products & Payments**, with useful sponsor integrations. Track 4 is excluded. The first demonstrator is a diaspora payer funding renovation work, a worker submitting evidence, and their agreed professional verifying completion.

The user requested this handoff and logical commits while implementation was in progress. Development and publishing should resume from this checkpoint; do not assume the earlier “publishing next” progress updates mean publication happened.

## 2. Product direction and rules to preserve

Accrue makes payment conditions understandable: fund work, agree what completion means, verify progress, and release earned allocations.

- One payer, one worker, and an optional independent verifier.
- Each milestone has an explicit worker allocation, verifier fee, acceptance criteria, and approval authority.
- Required participants accept fixed terms before funding.
- Approval credits worker and verifier together. It cannot pay twice.
- **Earned money never returns to the payer on expiry or cancellation.** Only unused reserve can be refunded.
- Evidence is private and versioned; its digest binds the approval to the reviewed submission.
- Corrections append to the record. They do not reverse a settled payment.
- Verifier activity is a history, not a trust score or proof that physical work happened.
- Keep the normal consumer journey free of unnecessary blockchain terminology, while preserving exact environment and payment disclosures.

### Additional ideas in the user's notepad

The existing `notepad.txt` is preserved unchanged. It proposes Monad-aligned styling, exceptionally simple mobile/desktop onboarding, instant cross-border payments without milestones, Mera-powered UX, Kimi/AI-agent possibilities, and broader use cases. These have **not** been implemented or validated as sponsor requirements. Reconcile them with the PRD before expanding scope. In particular, direct payments are a distinct flow and should not silently change the milestone escrow rules.

## 3. What is implemented

| Area | Actual implementation |
|---|---|
| Workspace UI | Responsive dashboard, agreement search/status filters, role selector, earnings, activity, connections disclosure, empty/loading/error states |
| Agreement creation | Scope, participants, expiry, up to 12 sequential milestones, worker/verifier amounts, payer or verifier approval |
| Acceptance and funding | Required-role acceptance, fixed terms, simulated full funding only after acceptance |
| Evidence | Private R2 upload/download, file limits, ownership checks, SHA-256 manifest, submission versions, request-changes and resubmission |
| Settlement simulation | Atomic allocations, beneficiary withdrawals, mutual cancellation, reserve-only refund, append-only corrections |
| Records | Persistent timeline, agreement JSON export, explicitly simulated payment receipts |
| Backend | Typed route handlers, Zod validation, owner-scoped D1 queries, optimistic concurrency, action idempotency, origin checks, per-user throttling |
| Escrow contract | Immutable token, participant acceptance, funding, sequential evidence/approval, withdrawals, cancellation/refund, corrections, events, reentrancy guard |
| Deployment preparation | Foundry deployment script checks the expected chain and token contract; it has not been broadcast |
| Agent interface | Feature-detected WebMCP read-workspace/open-agreement tools; runtime validation remains unavailable |

### Important simulation boundary

Signing into the website identifies the workspace owner. Switching to Worker or Verifier simulates that role **within the same owner's workspace**. Participant names are labels, not invited users or wallet bindings. This is useful for a demonstration, but is not production role authorization.

The Solidity contract separately authorizes actual caller addresses. Its accounting is tested, but it does not make the website's simulated balances onchain.

## 4. Architecture and source map

The initial PRD proposed Next.js + NestJS + PostgreSQL. For this prototype, the backend was consolidated into Next/Vinext route handlers on Cloudflare Workers, with D1 and R2. This reduces deployment complexity; the change is documented, not a claim that every original infrastructure component was implemented.

| Location | Responsibility |
|---|---|
| `docs/PRODUCT-REQUIREMENTS.md` | Snapshot of the full PRD; original remains in the parent workspace |
| `app/workspace.tsx` | Application shell and composition |
| `app/use-workspace.ts` | Fetching, state, mutations, navigation, WebMCP registration |
| `app/ui/` | Builder, dashboard, detail, milestones, confirmation dialogs, receipts/timeline, supporting pages |
| `lib/domain.ts`, `lib/domain-types.ts` | Pure sandbox state machine and accounting model |
| `lib/validation.ts`, `lib/server.ts` | Request schemas, hashing, auth, binding access, throttling, errors |
| `app/api/agreements/` | Create/list/action endpoints with ownership and revision checks |
| `app/api/evidence/` | Private file upload/download |
| `db/schema.ts`, `drizzle/` | D1 schema and two generated migrations |
| `contracts/src/AccrueEscrow.sol` | Separate non-upgradeable escrow implementation |
| `contracts/test/`, `contracts/script/` | Foundry tests and guarded deployment preparation |
| `tests/domain.test.mjs`, `tests/api-smoke.mjs` | Domain tests and local HTTP end-to-end test |
| `README.md`, `IMPLEMENTATION.md` | Startup commands and detailed implementation boundaries |

An agreement is a versioned JSON aggregate in D1. A mutation validates and computes the next state, then writes with a version comparison. A racing action cannot overwrite a newer revision. Evidence bytes live in R2; D1 owns the access metadata. Sandbox money is integer cents; contract money is raw token units. Never use these interchangeably.

## 5. Verification checkpoint

Full results, including what was measured and what was not, are in `VERIFICATION.md`. In summary, at the 12 September checkpoint:

- **Domain suite:** 15 tests passed, including 100 randomized complete sandbox journeys.
- **Contracts:** 16 tests passed, including 256 conservation fuzz runs.
- **TypeScript and build:** both clean.
- **Local HTTP workflow:** 15 checks passed, rerun after every change in this pass. It now also covers replayed agreement creation and duplicate evidence upload.
- **Dependencies:** all ten high-severity advisories cleared. Four moderate findings remain in the drizzle-kit toolchain, which is confirmed absent from the built Worker bundle.
- **Browser QA:** a complete three-role journey was driven at 360px, plus 768px and 1024px checks. Two layout/accessibility defects were found and fixed.
- **Not verified:** Enter/Space activation by a real keyboard, screen readers, contrast ratios, real mobile hardware, WebMCP runtime, wallet onboarding, real-chain transactions, sponsorship, Envio indexing, production database behaviour, or ten on-network rehearsals.

These are engineering checks, not an independent security audit or evidence of real-world payment readiness.

## 6. Immediate unfinished work

### A. Stabilize and publish the sandbox

The original items 1–5 are complete as of 12 September 2026, consolidated below. Publishing is not.

1. **Done.** Dependency advisories resolved: 14 findings (10 high, 4 moderate) reduced to 4 moderate. The React renderer and server-component packages were upgraded together to keep their versions matched. The four remaining findings are in the drizzle-kit toolchain, which has no non-breaking upstream fix and does not appear in the built Worker bundle.
2. **Done.** Build, type checks, domain and contract suites, and the local API smoke test all rerun and passing. The earlier duplicate React/hook-instance question is settled: one React copy is installed and a fresh browser tab logs no console errors.
3. **Done.** Browser, mobile and keyboard testing performed in Chromium at 360 / 768 / 1024px, including a complete payer → worker → verifier journey at 360px. Two defects were found and fixed: the agreement detail tab strip forced horizontal page scroll at 360px, and the dialog close control was a 16px target. Enter/Space activation could not be exercised through automation and still needs one pass on a real keyboard, as do screen readers, contrast ratios and real mobile hardware.
4. **Done.** Retry handling closed on both sides. The workspace holds one draft operation identifier until a creation is confirmed, so a timed-out retry returns the existing agreement instead of creating a second one. Identical evidence content for the same agreement now resolves to the stored file, and the submission dialog remembers files that already reached the server, so retries no longer leave unattached uploads behind. Both paths are covered by the HTTP smoke test.
5. **Blocked, not attempted.** Publishing to the registered Site needs the Sites host tooling and a source credential, neither of which is present in this repository or environment. `.openai/hosting.json` still names project `appgprj_6aa2f5d4901881919fe2cf457dcbb402`; reuse it rather than creating another Site. Registration is still not deployment, and no source push, saved version or successful deployment has been completed.

### B. Build the actual live product

1. **Real participants and onboarding:** choose Privy OR Dynamic; configure credentials, embedded account creation, bound addresses, expiring/revocable invitations, recovery, and membership-based evidence access. A forwarded invitation must not grant payment authority.
2. **Monad + token:** verify official network/token addresses, decimals, and permitted demo environment. Independently review the contract, deploy with explicit gas authorization, and record addresses and receipts.
3. **Chain-backed frontend:** implement wallet-authorized contract calls, pending/rejected/failed/confirmed states, reconciliation after timeouts, and real beneficiary withdrawal. Keep sandbox state completely separate from live settlement truth.
4. **Sponsorship:** implement a restricted gas flow for approved actions/accounts with quotas, budget limits, and clear fallback/outage behavior.
5. **Envio:** index the actual contract events, handle reorgs/duplicates, and reconcile against RPC before displaying consequential balances. Do not call the sandbox timeline an indexer integration.
6. **Operational hardening:** evidence scanning and retention/deletion, notifications, observability, public-service abuse controls, account recovery tests, direct-withdrawal guidance, incident handling, and privacy/legal review.

### C. Prepare the hackathon submission

- Recheck official Track 2 and individual sponsor requirements, deadline/timezone, eligibility, accepted network, and award-stacking rules. None should be inferred from earlier prize estimates.
- Show sponsor contributions through working onboarding and payment flows, not logos or configuration placeholders.
- Rehearse the three-minute renovation journey on actual devices: accept → fund → submit → verify → withdraw → show protected earnings and legitimate unused refund.
- Produce the required video, repository/deployment links, integration evidence, and honest simulation/prior-work disclosures.
- Defer P1 time agreements, collaborator splits, CRE, fiat cash-out, AI-agent roles, and additional payment templates until the core live flow is reliable.

## 7. Suggested two-builder split

**Builder A — settlement and infrastructure:** dependency compatibility, contract review/deployment, verified token/network setup, wallet transaction adapter, sponsorship, Envio/RPC reconciliation, financial failure tests.

**Builder B — product and participant experience:** real onboarding/invitations, clear role consent, private evidence membership, mobile/desktop UI, retries/recovery, notifications, receipts, demo and user testing.

Agree on a shared contract/account API before working independently. The next meaningful milestone is **one genuine three-account on-network flow**, not additional breadth in the sandbox.

## 8. How to resume safely

- Work inside the `accrue/` repository. Node 22.13+ is required; this machine's default Node was too old. Node 24.13 was used for successful commands.
- Read README.md and IMPLEMENTATION.md, then inspect the latest logical commits and VERIFICATION.md.
- Dependencies are installed. All three D1 migrations were already applied to the local `.wrangler/state` database. **Do not replay them there.** A fresh checkout/database follows the README migration sequence, which now includes `0002_robust_mathemanic.sql` (the evidence content index).
- Local test records are clearly named `[API TEST] Renovation` or `[MOBILE QA] Lekki renovation`; uploaded evidence is synthetic. Do not copy local D1/R2 data into a production deployment.
- Work in this pass is on the `sandbox-stabilization` branch, four commits ahead of `main`; merge it when you are satisfied with the review.
- Preview was served at `http://localhost:5173/`; the process may need restarting. Local development sign-in uses the starter's synthetic identity. A running preview is not a hosted URL.
- Sites registration is stored in `.openai/hosting.json`. Reuse project `appgprj_6aa2f5d4901881919fe2cf457dcbb402`; do not create another Site. Obtain a fresh source credential if necessary and never commit it.
- Keep caches, build output, runtime database files, and secrets untracked. Downloaded research and printouts in the parent workspace are deliberately outside this app repository.
- No contract deployment, public sharing, or real-money transaction has been performed. Do not imply otherwise in the UI or submission.

## 9. Decisions taken for the live-build phase

Settled 13 September 2026 against the signed-in application platform. Full evidence and sources are in `docs/RULES-AND-NETWORK.md`.

- **Account layer: Mera**, not Privy or Dynamic. The $10,000 Agora cross-border bounty names Mera passkey onboarding as a requirement, and that bounty describes this product almost verbatim.
- **Network: Monad testnet, chain 10143.** Agora publishes an AUSD testnet deployment with a faucet, confirmed on chain, so the cross-border story needs no real money.
- **Token: AUSD** at `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`, 6 decimals. Raw base units, never the sandbox's cents.
- **Surface: the responsive PWA.** A native Expo app is deferred, not cancelled — see the backlog below.
- **Product: a direct AUSD send joins milestone escrow.** The bounty's deliverable is a send/receive settled instantly, which escrow alone does not show. The notepad's instant-payment idea becomes a first-class flow. Escrow rules do not change to accommodate it.
- **Deadline: 14 Oct 2026, 04:59 GMT+1.** Registration closes 6 Oct; submissions open 22 Sep.

### Deferred backlog

1. **Native Expo application.** The Agora bounty says "mobile app" and the PWA's eligibility for that wording is unconfirmed; a native build removes the ambiguity. Deferred by decision so the live chain flow lands first.
2. P1 time agreements, collaborator splits, CRE, fiat cash-out, AI-agent roles, additional payment templates.
3. Privy and Dynamic bounties, unavailable once Mera is the account layer unless a genuinely separate use appears.

### Still unverified

- Whether a PWA satisfies the Agora bounty's "mobile app" wording. Largest eligibility risk on the largest prize; ask the organizers.
- The official rules text: country eligibility, video length, repository visibility, award stacking.
- What Agora's staging API offers beyond the token contract.
- Mera SDK specifics: session scoping, PRF key derivation, browser passkey support.
