# Accrue implementation handoff

## What this release is

A working private, persistent milestone-payment sandbox plus a separate tested Solidity escrow implementation. It is **not the completed live-money P0 release** defined in the PRD. There is no connected wallet or deployed payment contract behind the website. No sponsor eligibility, token support, or live settlement is claimed.

The website uses a single authenticated workspace owner. The role selector deliberately simulates payer, worker, and verifier inside that owner's sandbox. Names are display labels, not authenticated participants. Other signed-in users cannot access that owner's records through the APIs.

## Working product capabilities

- Responsive agreement dashboard with search and status filters, earnings, activity, and integration disclosure.
- Agreement builder with up to 12 sequential milestones, explicit worker/verifier amounts, objective criteria, fixed terms, and expiry.
- Required-role acceptance before simulated funding; payer approval or independent verifier approval.
- Private evidence uploads/downloads in R2, server-validated file access, SHA-256 manifests, versioned resubmissions, and changes requested without payment.
- Atomic sandbox allocations, protected earned balances, beneficiary withdrawals, mutual cancellation, unused-reserve refunds, and append-only corrections.
- Durable D1 persistence, owner-scoped queries, optimistic concurrency, operation replay protection, cross-origin rejection, and per-user request throttling.
- Agreement export and explicitly simulated payment receipts. Evidence, personal details, and fake transaction hashes are not placed on a chain.
- Feature-detected WebMCP tools for reading the workspace and opening an existing agreement. Browser-runtime registration validation was unavailable; these tools do not authorize money actions.

## Architecture decisions versus the PRD

The proposed separate NestJS/PostgreSQL services were consolidated into typed Next/Vinext route handlers and Cloudflare D1/R2 to fit a privately hosted two-builder prototype. The sandbox domain engine and Solidity implementation are independent; their corresponding invariants are tested separately. A live application must not use the sandbox HTTP ledger as settlement truth.

### Data and security model

The agreement is a versioned aggregate stored as JSON under an indexed owner. Each action loads it, validates the action and state, applies all accounting changes in memory, and performs one compare-and-swap update. Concurrent actions against the same revision cannot both settle. Idempotency operation identifiers live inside that aggregate. R2 objects are addressed by random IDs; downloads authorize ownership through D1 first. D1 has no user-supplied SQL interpolation.

Sandbox amounts are integer USD cents. Contract amounts are raw token units. A future adapter must read and validate token decimals and must never forward UI cents directly as token units.

Uploads accept JPG, PNG, PDF, and text at up to 10 MB per file. Downloads use attachment disposition, `nosniff`, private no-store caching, and a restrictive content policy. Files are not malware-scanned or content-verified; use synthetic or consented evidence. Prototype files remain until the deployment or an operator cleanup removes them. Evidence retention, deletion tooling, and malware scanning must be completed before a public launch.

### Contract design

`contracts/src/AccrueEscrow.sol` is non-upgradeable with an immutable token and no administrator balance-redirection function. Participants accept the computed terms hash through their own accounts. Calls rely on native transaction authentication; there is no offchain signed-message relay or ERC-1271 verification path in this release. Smart accounts could make direct calls, but wallet/provider interoperability has not been validated.

Funding checks the exact received token balance. Only the assigned approver may accept the current evidence hash. Approval credits worker and verifier in one transaction. Beneficiaries withdraw to their own sender address. Expiry blocks approvals but never withdrawals. Cancellation requires every required role; only unused reserve can be refunded. Failed ERC20 transfers revert state. This expects a vetted, exact-transfer, non-rebasing token; issuer controls and future token changes remain external risks.

## Local development

Use Node 22.13 or later (validated with Node 24.13), npm, and Foundry for contracts.

```sh
npm ci
npm run build
```

Execute the numbered SQL files in `drizzle/` once, in order, using the exact commands in README.md, then run `npm run dev`. Never replay migration files against an existing database. The hosted deployment applies packaged migrations.

Open the local preview, sign in using the development-only sign-in route, and choose “Explore a sample agreement.” Switch to Worker and Verifier to accept, then Payer to fund. Submit as Worker, approve as Verifier, and withdraw as each beneficiary. The local mock identity is supplied by the starter's development middleware and is not part of the production authentication path.

## Verification commands

```sh
node --test tests/domain.test.mjs
npx tsc --noEmit
node tests/api-smoke.mjs
cd contracts
forge test -vv
```

The API test is restricted to localhost and creates clearly named synthetic test records. It checks authentication, origin rejection, uploads/downloads, versioned evidence, an approval race, allocation, withdrawals, corrections, cancellation/refund, and persistence after reload. Do not run against a live database. The contract suite includes 256 fuzz cases for conservation as well as permission, replay, expiry, transfer-failure, correction, and isolation tests. These tests are not an independent audit.

## Live deployment preparation

The separate Foundry deployment script refuses an unexpected chain ID or a token address without code. It is intentionally not run automatically. After independently verifying the required network/token and obtaining approval to spend deployment gas:

```sh
forge script script/Deploy.s.sol:Deploy --rpc-url "$ACCRUE_RPC_URL" --account <encrypted-keystore-name>
```

Set `ACCRUE_EXPECTED_CHAIN_ID` and `ACCRUE_TOKEN_ADDRESS` from verified official sources. This command simulates only; add `--broadcast` only after explicitly reviewing and authorizing the deployment. Use an encrypted signer/keystore, never a committed private key. No token address or chain ID is guessed in this repository.

## Remaining live-release gates

1. Select and configure Privy OR Dynamic. Bind actual authenticated participants to accounts, implement expiring/revocable invitations and account recovery, and validate gas sponsorship.
2. Verify Monad and Agora network/token requirements and sponsor rubrics. Deploy and independently review the escrow. Obtain actual deployment addresses and transaction receipts.
3. Implement a chain-backed mode with user-authorized contract calls, receipt reconciliation, failed/pending transaction recovery, and an explicit one-way separation from sandbox balances. Connect private evidence access to real agreement membership.
4. Build Envio event projections with reorg handling and RPC fallback. Do not relabel D1 sandbox events as chain indexing.
5. Complete notifications, evidence retention/deletion and scanning, public-service abuse controls, privacy/legal review, monitoring, and incident playbooks.
6. Validate actual-device wallet recovery, rejection, sponsor outage, failed transfers, mobile accessibility, and ten on-network rehearsals. The current HTTP smoke test is not an actual-device rehearsal.
7. P1 time accrual, collaborator splits, Chainlink CRE, and fiat payouts remain outside this release. Track 4 remains excluded.

Do not deposit real funds into this prototype or submit it as a fully integrated sponsor demonstration without completing these gates.
