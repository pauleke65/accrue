# Verification

Two checkpoints. The first is the submission state on 1 October 2026; the
second, kept below for history, is the first live-settlement checkpoint on
13 September. Test money on a test network in both, and nothing here is an
audit.

## Checkpoint — 1 October 2026 (submission)

Run against `main` at `ab1d858` plus the fixes listed below, and against the
live deployment at https://accrue.accrue-escrow.workers.dev.

| Check | Result | Notes |
|---|---|---|
| Unit: `node --test tests/domain.test.mjs tests/chain.test.mjs tests/next-actions.test.mjs tests/proof-checks.test.mjs` | PASS, 46 tests | |
| TypeScript: `npx tsc --noEmit` | PASS, exit 0 | |
| Build: `npm run build` | PASS | Production config still binds Workers AI |
| Contracts: `forge test` (Foundry 1.5.1, solc 0.8.30) | PASS, 41 tests | v2 source; includes 256 conservation fuzz runs |
| Live constants: `node tests/chain-live.mjs` | PASS, 9 checks | Chain id, AUSD decimals, faucet, escrow bound to AUSD |
| HTTP: `node tests/api-smoke.mjs` | PASS, all checks | After the evidence fix below; failed before it |
| Tags: `node tests/tags-smoke.mjs` | PASS, 8 checks | |
| Visibility: `node tests/participant-visibility-smoke.mjs` | PASS, 6 checks | |
| Fresh database: every migration in `drizzle/` in order | PASS | Failed at `0006_shared_parties.sql` before the fix below |
| `npm run dev` on a clean clone without a Cloudflare login | PASS | Failed before the fix below |
| PWA: Chrome `Page.getInstallabilityErrors` | PASS, no errors | Manifest added in this checkpoint |
| Deployed bytecode against source | MATCH | `AccrueEscrow` = commit `38999ea`, `AccrueDigitalWork` = commit `c1abd65`, apart from metadata and immutables |
| **Live end-to-end on the deployed app, real passkey path** | **PASS** | See below |
| **Mera stateless test on the deployed app** | **PASS** | Same account after clearing all browser storage; see below |
| Lint: `npm run lint` | 9 errors, 11 warnings | React Compiler heuristics against deliberate mount-time reads and a latest-ref pattern; none is a runtime fault |
| Not rerun | | `sponsor-smoke`, `live-agreement-smoke` and `escrow-live-journey` need funded private keys that were not in this environment; the live run below exercises the same contract paths through the interface |

### Live end-to-end run on the deployed app

Driven in Chromium 141 by Playwright against the live deployment, with a
WebAuthn virtual authenticator that supports PRF. The 13 September checkpoint
could not test the passkey success path because the automation browser had no
PRF authenticator; this one does, so account creation went through Mera's
real `createPasskeyWithPrfOutput` and every transaction below was signed by a
key derived from that passkey. Each hash was then re-read from the chain:
all have status 1.

**Guided walkthrough** (one passkey; client, worker and reviewer accounts),
milestone escrow `0xf8c4…0De`:

| Step | Transaction | Confirmed in |
|---|---|---|
| Test funds | Claimed through the sponsor (server-side transaction) | |
| Client creates the job | [`0x724f05…0bff`](https://testnet.monadvision.com/tx/0x724f055bcde0ca7d9a3997f441f4cd95b1761cd4f8a380851f2dfe4bf99f0bff) | 142 ms |
| Worker accepts the terms | [`0xb564b4…e517`](https://testnet.monadvision.com/tx/0xb564b4fafdaf73a11180a7301cc2508707727dfc5ae0de5c936ca8057dc5e517) | 575 ms |
| Reviewer accepts the terms | [`0x3c3b61…1c3b`](https://testnet.monadvision.com/tx/0x3c3b6193e023ad93c79a98cc73815654e819496fa2b2a7dbba244e800b791c3b) | 177 ms |
| Client approves AUSD for funding | [`0x6d3a76…2bca`](https://testnet.monadvision.com/tx/0x6d3a76335f88c85841fcd4343fc0bd0880479f3e1cd1411d6dbf8f77f2482bca) | 815 ms |
| Client funds 2.20 AUSD | [`0x0494c5…7e04`](https://testnet.monadvision.com/tx/0x0494c5c92374c529c13dc6d0dfca0ebea8a203e759dfc6570b0bf16af8d47e04) | |
| Worker submits stage 1 | [`0x990c67…917b`](https://testnet.monadvision.com/tx/0x990c67d7ed41795d4c6c50490665574d8b1b3e8ba33acd95ed5a92baf1fb917b) | 584 ms |
| Reviewer approves: worker and fee paid together | [`0x167893…7489`](https://testnet.monadvision.com/tx/0x167893b65d7727e3777c025945e524384f5318a94b744dbb0a2e2f3d51187489) | 704 ms |
| Worker withdraws 1.00 AUSD | [`0xba1c34…f66b`](https://testnet.monadvision.com/tx/0xba1c346cb9ba89830232154eba7d03541007bf6ea1a58de849f9e9c2ce3df66b) | 482 ms |

The app's own counter at the end: eight transactions, 501 ms on average.
Stage 2's money stayed locked. The first action by each brand-new role account
waited about 30 seconds for its sponsored gas before it was signed.

**Direct send and stateless test** (product mode, one account per passkey):

- **Direct send**, on a second passkey: 10,000.00 AUSD in the wallet 1.5 s
  after "Claim test funds".
- The first send asked for an `@name`; `@qa_9n0sq` was claimed by signature.
- 0.25 AUSD sent by address:
  [`0x9f71ab…3395`](https://testnet.monadvision.com/tx/0x9f71ab1daa11c906d8556db7f3ca84fb25e68e65a6af57ebd74259bc1cff3395),
  confirmed in 685 ms. The Send page's history was read through Envio.
- **Stateless test**, on a third passkey: after creating the account and
  claiming test funds, all local and session storage was cleared and the page
  reloaded, which signs out. "I already have one" with the passkey alone
  restored the same account, `0xD516155Db7c03A2E2BDD30E90A8f924ACA7C69e2`, and
  its 10,000.00 AUSD balance. No credential id was remembered, so the
  authenticator offered the discoverable passkey itself, as on a fresh device.

Both runs left test records on the live deployment: one walkthrough job
between derived accounts, and the tag `@qa_9n0sq` ("QA run (automated)").

### Fixed while verifying

- **Private evidence downloads were open to anyone holding a file id.**
  `GET /api/evidence` computed the caller and never used it. It now serves only
  the uploader's own files and answers 404 otherwise. No screen calls it today.
- **A fresh database failed the README's migration loop** at
  `0006_shared_parties.sql`, leaving `agreement_parties` uncreated; the
  overlapping index statements are now `IF NOT EXISTS`.
- **`npm run dev` failed without a Cloudflare login**, because Workers AI was
  bound remotely; local development now binds it only with credentials.
- **The app was not installable.** It shipped no web manifest; it now has one,
  with icons, and Chrome reports no installability errors.
- Three smoke assertions still expected 401s from before the standalone
  deployment served callers without a ChatGPT session; they now check what
  must hold instead (isolation, public tag lookup).

### Not verified

Real phone hardware with a physical authenticator; ten consecutive rehearsals;
screen readers; slow networks; sponsor or RPC outage behaviour; an independent
contract audit.

## Checkpoint — 13 September 2026 (historical)

Kept as recorded. Rows marked NOT IMPLEMENTED or NOT COMPLETED here have since
been built: gas sponsorship, Envio history and the hosted deployment are all
live in the checkpoint above.

These results describe the source at the first live-settlement checkpoint. Real transactions now run on Monad testnet. That is test money on a test network and establishes nothing about production readiness.

| Check | Result | Timing / qualification |
|---|---|---|
| TypeScript: `npx tsc --noEmit` | PASS, exit 0 | Fresh, after the dependency upgrades and UI fixes |
| Domain: `node --test tests/domain.test.mjs` | PASS, 15 tests, 0 failures | Fresh; includes 100 randomized complete journeys |
| Contracts: `forge test` | PASS, 16 tests, 0 failures | Fresh; Solidity 0.8.30; includes 256 conservation fuzz runs |
| Application: Sites `build-site.mjs` | PASS, exit 0 | Fresh; all five build stages completed |
| HTTP: `node tests/api-smoke.mjs` | PASS, 15 checks | Fresh against the local dev server, after every change below |
| Full npm dependency audit | 4 moderate, 0 high | Was 14 findings (10 high, 4 moderate); see below |
| Lint: `npm run lint` | 2 errors, 70 warnings | Both remaining errors are deliberate; see below |
| Colour contrast (WCAG AA) | PASS, 0 failures | Measured with alpha compositing on dashboard, agreement detail and earnings after the Metropolis restyle |
| Browser QA at 360 / 768 / 1024px | PASS, two defects found and fixed | Chromium; complete payer → worker → verifier journey driven at 360px |
| Keyboard: focus order and visible focus | PASS | Activation by Enter/Space not exercised; see below |
| WebMCP runtime validation | UNAVAILABLE | Feature-detected read/navigation tools present |
| Live AUSD transfer on Monad testnet | PASS, settled in 0.8s | 25.50 AUSD moved between accounts; balances exact before and after |
| Agora faucet drip | PASS | 10,000 AUSD received through the app's own code path |
| Escrow deployment | PASS | Deployed, verified on MonadScan, token binding re-read from chain |
| Live constants check: `node tests/chain-live.mjs` | PASS, 9 checks | Runs against the real chain; no key or funds needed |
| **Three-account escrow journey on testnet** | **PASS** | Separate payer, worker and verifier accounts; full milestone lifecycle; see below |
| **Funded job through the app's own path** | **PASS** | `tests/live-agreement-smoke.mjs`: tags, metadata API and contract together |
| Tags: `node tests/tags-smoke.mjs` | PASS, 8 checks | Claim, resolve, forgery, replay and squatting |
| Sponsorship: `node tests/sponsor-smoke.mjs` | PASS, 5 checks | An account with nothing can claim and transact |
| Passkey success path | NOT TESTED | Needs a PRF-capable authenticator; the automation browser has none |
| Gas sponsorship / Envio / bank payout | NOT IMPLEMENTED | Unchanged |
| Private deployment | NOT COMPLETED | Site registered only; no verified hosted URL |

### Live settlement

Deployed and exercised on Monad testnet (chain 10143) on 13 September 2026.

| Item | Value |
|---|---|
| Escrow | `0xf8c44A529cd0470597C7865d2B2473abff65d0De` |
| Deployment transaction | `0x6ce946bbb8c807e1b6c251869b29cf5023b9da292eff4091eedb2e1e2bcfa637` |
| Block | 62,038,044 |
| Source | Verified on MonadScan, exact match, solc v0.8.30 |
| Token binding | AUSD, re-read from the deployed contract rather than assumed |
| Faucet drip | `0x62244aa08741a926789d2fbd3aa7bfb11b5c4ed082e894e8101fa4ff60f5848e` |
| AUSD transfer | `0x2e592241abc2fe17fa79734481ddd14055b616443395c7106d1bedbc1ba05586`, settled in 0.8s |

#### Three-account milestone journey

`node tests/escrow-live-journey.mjs`, run on 13 September 2026 against agreement #1. Payer, worker and verifier are three separate accounts, each signing its own transactions, so the contract's authorization is exercised rather than simulated by a role switch. 128.50 AUSD was deposited, 120.00 paid to the worker and 8.50 to the verifier.

What the run proves on chain, with every assertion checked to the base unit:

- Three separate accounts signed their own actions.
- The terms hash computed locally matches the one the contract derived, so a participant cannot accept terms other than those they were shown.
- An account with no role in the agreement cannot accept it.
- The payer cannot approve a milestone whose named approver is the verifier.
- Approval credits worker and verifier in the same transaction.
- A second approval does not pay twice, and earnings are unchanged by the attempt.
- A second withdrawal does not pay twice, and balances are unchanged by the attempt.
- Withdrawn amounts equal the agreed allocations exactly.

The first run of this journey found a real defect: the milestone state constants in `lib/escrow.ts` had been written from assumption rather than from the contract, which defines three states with no distinct "changes requested" value. Corrected, and the workflow status for that case is application state rather than chain state.

The escrow holds nothing further and has had no independent audit. The sandbox agreements do not use it. The live transfers above were signed with the local testnet deployer key in Node, not through the passkey interface, which remains untested on a real authenticator.

### HTTP smoke coverage

Unauthenticated access rejection; replayed-creation idempotency; cross-origin mutation rejection; required acceptance and funding; private R2 upload and authorized download; duplicate-upload reuse; evidence changes/resubmission; concurrent approval conflict; atomic worker/verifier allocations; withdrawal; correction; mutual cancellation; unused-reserve refund; reload persistence.

### Dependencies

Ten high-severity advisories were cleared by upgrading React, React DOM and react-server-dom-webpack together to 19.3.0, Next to 16.3.5, vinext to 1.0.0-beta.9, Vite to 8.3.0, `@cloudflare/vite-plugin` to 1.54.8, plugin-rsc to 0.5.34, plugin-react to 6.1.1, wrangler to 4.131.1 and workers-types to 5.20260911.1. The renderer and server-component packages were moved as a set so their versions stay matched.

Four moderate findings remain, all in `drizzle-kit` → `@esbuild-kit/*` → `esbuild`. drizzle-kit 0.31.10 is the latest release and still depends on that deprecated loader, and the only fix npm offers is a breaking downgrade to 0.18.1. The advisory concerns the esbuild development server. `grep` over `dist/` confirms neither drizzle-kit nor `@esbuild-kit` appears in the built Worker bundle; the package is used only by the local `db:generate` command.

Only one copy of React is installed — no nested `node_modules/*/node_modules/react` exists — and a fresh browser tab against the dev server logs no console errors. That closes the earlier open question about duplicate React/hook instances.

### Browser and device QA

Driven in Chromium at 360×780, 768×1024 and 1024px. A complete journey was performed at 360px: create agreement, accept as worker, accept as verifier, fund as payer, submit evidence, approve as verifier, withdraw as worker. Allocations, the earnings split and the reserved balance were correct at each step, and reload persistence was confirmed.

Two defects were found and fixed:

- The agreement detail tab strip measured 367px against a 360px viewport, so the entire page scrolled horizontally at the width the layout rules name explicitly. The strip now scrolls inside its own row; every page measured 0 overflowing elements afterwards.
- The dialog close control was a 16×16 icon, below the 24px minimum target size. It is now a 44px target.

All interactive elements have accessible names, `lang` is set, no image lacks alt text, and no positive `tabindex` distorts the tab order. Focus moves into the first field when a dialog opens, the focus outline is visible (2px brand purple, offset 2px, after the restyle), and Escape closes a dialog.

Enter/Space activation was **not** verified: synthetic key events do not trigger native button activation, so the automation cannot exercise it. The controls are real `<button>` elements, for which activation is handled by the browser. A person should confirm this on a real keyboard.

Not measured: screen readers, slow-network upload behaviour, or any real mobile device.

### Metropolis restyle

The interface follows the Monad Metropolis hackathon page: surface `#0f0f12`, raised panels `#16161a`, paper ink `#fbfaf9`, dimmed ink `#9d9db2`, hairline structure at `#ffffff17`, brand purple `#6e54ff`, square corners, mono uppercase labels at 0.18em tracking, and a pixel display face for page titles. Those colour values are Monad's own published tokens, read from the live page.

The two typefaces are stand-ins: Monad's brittiSans and Metropolis Pixel are not redistributable, so the interface loads Inter for text and Silkscreen for the display role, which is the same substitution the source page's own fallback chain makes.

Every text colour was re-measured against its composited background after the restyle; all three surveyed pages report zero AA failures. Status hues were lifted for the dark surface (`#6ee7a8` positive, `#e8b339` caution, `#ff7a9c` negative) and placeholder ink has its own step at `#8a8a9c`, because the faint hairline value does not clear 4.5:1 as text. Three layout regressions the mono tracking introduced — the role selector, the dashboard filter strip and the mobile navigation — were fixed and re-measured at 360px.

### Funded jobs

`node tests/live-agreement-smoke.mjs`, run 13 September 2026 against agreement #2. This is the join the product was missing: the payer names a worker and a verifier by tag, the contract holds real AUSD, the readable terms sit beside it, and each role signs its own actions.

What the run proves:

- A payer names people by tag rather than by address, and the tag resolves to the account that signs.
- The scope and criteria stored by the app hash to the values the contract enforces, so the readable terms and the enforced terms are the same agreement rather than two.
- The contract holds the deposit until the named verifier approves.
- Approval credits worker and verifier in one transaction, and each is paid exactly what was agreed.

No balance is stored by the app for these agreements. Deposit, reserve, earnings and withdrawals are read from the chain each time they are displayed, so the record cannot drift from the money.

### Lint

Two errors are left deliberately. `Date.now()` is read during render because that is how a milestone decides whether it has expired, and the workspace hook fetches on mount, which the effect rule flags as a synchronous setState. Both are heuristic reports against intentional patterns.

Replacing the brand anchor with `next/link` was attempted and reverted: the vinext link shim resolves a second React copy through dependency optimisation and throws an invalid-hook-call that blanks the page. The rule is disabled on that one line, with the reason recorded in the source.

### Release gate

No independent contract audit, public multi-user authorization validation, real token transfer, sponsor outage test, production evidence-retention review, or actual-device rehearsal has been completed. Do not handle real funds or describe this checkpoint as the finished live P0 product.
