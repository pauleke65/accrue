# Accrue — product and engineering handoff

Prepared 11 September 2026. This document describes the actual checkpoint, not the intended finished product.

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

- **Domain suite:** 15 tests passed again during this handoff, after the domain/type split. Includes 100 randomized complete sandbox journeys within one test.
- **TypeScript:** the current source passed `tsc --noEmit` during this handoff.
- **Contracts:** a fresh handoff run passed 16 tests, including 256 fuzz cases; recorded in `VERIFICATION.md`.
- **Local HTTP workflow:** passed after throttling was added, before the last UI/module-only extraction. It exercised sign-in gating, cross-origin rejection, R2 upload/download, evidence resubmission, concurrent approvals, allocations, withdrawal, correction, mutual cancellation, protected refund, and persistent reload.
- **Build:** the latest source/dependency build passed during handoff; all five build stages completed. See `VERIFICATION.md`.
- **Not verified:** actual-device/browser interaction or visual QA, WebMCP runtime, wallet onboarding, real-chain transactions, sponsorship, Envio indexing, production database behavior, or ten on-network rehearsals.

These are engineering checks, not an independent security audit or evidence of real-world payment readiness.

## 6. Immediate unfinished work

### A. Stabilize and publish the sandbox

1. Resolve remaining dependency advisories and test compatibility. Next was updated from 16.2.6 to 16.3.4, and compatible transitive updates were applied. The latest full audit still reported **14 findings: 10 high and 4 moderate**, concentrated in framework/build tooling and dependencies. Dev-dependency classification does not prove a package is absent from the deployed Worker bundle.
2. Candidate fixes reported by npm include newer Vinext, Vite, Cloudflare tooling, and React server components. Upgrade deliberately; do not blindly use `npm audit fix --force`, which proposed a breaking Drizzle downgrade. Recheck React renderer/server-component version compatibility together.
3. Rerun build, type checks, domain/contract suites, and the local API smoke test after upgrades. Inspect prior development warnings about duplicate React/hook instances; earlier warnings appeared during dependency optimization/HMR and were not independently browser-verified as resolved.
4. Perform authorized browser/mobile/keyboard testing. The interface has responsive styles, but those are not a measured accessibility or device pass.
5. Improve retry handling: the server supports idempotent agreement creation, but the client currently generates a fresh creation ID on each retry. Preserve a stable draft-operation ID across uncertain responses. Evidence retries may also leave bounded unattached uploads; add cleanup/reuse.
6. Publish privately using the existing Sites registration. Registration alone is not deployment. No source push, saved version, or successful deployment was completed at this checkpoint.

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
- Dependencies are installed. Both D1 migrations were already applied to the local `.wrangler/state` database. **Do not replay them there.** A fresh checkout/database follows the README migration sequence.
- Local test records are clearly named `[API TEST] Renovation`; uploaded evidence is synthetic. Do not copy local D1/R2 data into a production deployment.
- Preview was served at `http://localhost:5173/`; the process may need restarting. Local development sign-in uses the starter's synthetic identity. A running preview is not a hosted URL.
- Sites registration is stored in `.openai/hosting.json`. Reuse project `appgprj_6aa2f5d4901881919fe2cf457dcbb402`; do not create another Site. Obtain a fresh source credential if necessary and never commit it.
- Keep caches, build output, runtime database files, and secrets untracked. Downloaded research and printouts in the parent workspace are deliberately outside this app repository.
- No contract deployment, public sharing, or real-money transaction has been performed. Do not imply otherwise in the UI or submission.

## 9. Decisions needed before the next live-build phase

Choose the embedded-wallet provider, confirm access to its dashboard/credentials and sponsorship, verify the competition's network/token requirements, and decide whether the notepad's direct-payment/Mera/AI ideas belong in this submission or a later release. Until then, finish the sandbox quality checkpoint without representing it as the full live product.
