# Accrue — Product Requirements Document

Version 1.0 · 9 September 2026 · Standalone Metropolis submission

**Primary track:** Track 2 — Consumer Products & Payments  
**Team:** Two builders  
**Status:** Build specification; external integration gates identified below  
**Product promise:** Fund the job. Agree what completion means. Get paid when the work is verified.

## 1. Product definition

Accrue helps people pay for work across borders with agreed payment conditions. A payer funds an agreement, an earner performs the work, and an optional independent verifier confirms that a milestone meets the agreed criteria. Confirmation makes the earner’s allocation withdrawable and earns the verifier their agreed fee in the same transaction.

The initial customer is someone abroad funding a small construction or renovation project in Nigeria. They need evidence of progress before releasing the next payment. The builder needs confidence that money is available and that a completed milestone will not depend on the client’s goodwill. Both choose a verifier they already trust, such as a site engineer.

Accrue is a consumer application backed by payment contracts on Monad. It is a standalone product, separate from Ankara. Its hackathon story is reliable, understandable payments. Verifier history supports that story; identity infrastructure and Track 4 are outside the submission strategy.

### Positioning

“Accrue lets you fund work across borders and release payment when an agreed professional verifies completion. The worker and verifier receive their allocations together, and the payer cannot reclaim money already earned.”

### Why use a chain?

The parties can inspect the funded balance and enforce the agreed allocation rules without giving Accrue unilateral control over their escrow. Settlement and payment receipts share a verifiable record. This does not prove physical work occurred: the named verifier supplies that judgment.

The guarantee is specifically about powers in Accrue’s contracts. It does not imply immunity from token issuer controls, compromised accounts, chain failures, or external legal processes. UI and marketing must avoid claims that every component is irreversible or risk-free.

## 2. Goals, non-goals, and assumptions

### Goals

1. Demonstrate a complete funded agreement, verified milestone, and withdrawal on Monad.
2. Make payer, worker, and verifier roles understandable within 15 seconds.
3. Let a first-time worker or verifier participate without installing a wallet or purchasing gas.
4. Protect earned balances while giving the payer a defined way to recover unused funds.
5. Make sponsor integrations part of the working payment flow and document their contribution.
6. Deliver a runnable, reviewable submission with reproducible tests and an honest account of live versus simulated integrations.

### Non-goals for the hackathon

- Public verifier marketplace, automated matching, professional licensing verification, bonding, or slashing.
- Lending, yield, trading, bridges, proprietary tokens, or insurance.
- Automated AI decisions about whether physical work meets specifications.
- Full construction project management or legal dispute resolution.
- Production bank payouts unless an appropriate provider integration is available and validated.
- Public SDK, app-store launch, feature-phone/USSD support, or Track 4 positioning.

### Working assumptions

- Users have a smartphone or web browser with intermittent internet access.
- A responsive web application/PWA serves all three roles. Native Expo applications are a later delivery option, not a dependency for the demo.
- Agreements use one supported stablecoin per deployment; AUSD is the preferred candidate for the Agora integration, subject to verification of network, token, and bounty requirements.
- The demonstrator runs on the network permitted by current competition rules. Test tokens and simulated payout adapters are conspicuously identified.
- Both parties already know their verifier. The prototype records mutual selection, not a claim that Accrue has vetted the person.

## 3. Users and jobs to be done

| Role | Job to be done | Key concern | Successful outcome |
|---|---|---|---|
| Diaspora payer | Fund a defined job without releasing everything upfront | Non-delivery or premature approval | Sees funded reserves, evidence, and each release |
| Builder/earner | Start work knowing payment is reserved | Withheld approval or retroactive changes | Accepted work becomes withdrawable immediately after settlement |
| Verifier | Inspect against agreed criteria and earn an agreed fee | Ambiguous expectations or uncompensated work | Signs a specific milestone decision and sees a fee allocation |
| Support operator | Help explain failed actions and recover application access | Accidentally gaining control of escrow | Can inspect diagnostics without reallocating funds |

The initial verifier fee compensates a successful completion attestation. A rejected inspection earns no fee in v1. This creates an incentive toward approval and must be disclosed during agreement review. A later inspection contract can pay for a submitted report independently of its result; that is not silently assumed by this design.

## 4. Scope and priorities

**P0 is the minimum complete submission. P1 follows once P0 passes end-to-end tests.**

| Capability | Priority | Boundary |
|---|---|---|
| Embedded account onboarding and participant invitations | P0 | One wallet provider; passkey where supported, supported fallback otherwise |
| Draft, accept, fund, and activate agreement | P0 | One payer, one earner, optional one verifier |
| Payer-approved and verifier-approved milestones | P0 | Fixed allocations; no partial milestone approval |
| Evidence submission and inspection decision | P0 | Private evidence with immutable digest in attestation |
| Atomic worker and verifier allocations | P0 | One successful attestation earns both allocations |
| Withdrawal of earned funds | P0 | Separate from accrual; beneficiary-controlled |
| Expiry and refund of unused funds | P0 | Earned allocations excluded permanently |
| Timeline, receipts, notifications, retries | P0 | Indexer-backed UI with direct-chain fallback |
| Verifier activity record | P0 | Counts and values with limitations; no trust score |
| Gas sponsorship | P0 | Restricted to supported contract actions |
| Time-based agreements | P1 | Separate agreement template; bounded linear accrual |
| Chainlink CRE integration | P1 | Evidence-manifest validation, if supported and bounty-relevant |
| Collaborator splits | P1 | Fixed recipient and percentage accepted before funding |
| Fiat payout adapter | P1 | Sandbox or live provider mode explicitly labeled |
| Metered billing, x402, marketplace, native apps | Later | Not required for the central payment story |

## 5. Core user journeys

### 5.1 Create and fund an agreement

1. Payer signs in and selects “Pay for a project.”
2. Payer enters title, scope, earner, stablecoin amount, milestone descriptions, objective acceptance criteria, and deadlines.
3. For each milestone, select payer approval or the named verifier. Enter the worker allocation and verifier fee separately. The UI shows the total required deposit.
4. Invite the earner and verifier. Each authenticates, binds an account, and accepts the exact agreement version and their role. A forwarded invitation alone grants no payment authority.
5. The review screen shows amounts, addresses behind display names, release authority, expiry behavior, cancellation terms, and fees.
6. Payer funds the accepted agreement. The app marks it active only after a successful transaction receipt under the selected network confirmation policy.
7. All parties see “Funded,” the reserved amount, and the next milestone. A pending or failed funding transaction must never display as funded.

### 5.2 Submit and verify work

1. Earner opens the next milestone and submits an evidence package: checklist, notes, and optional photos or documents.
2. Submission creates a versioned manifest with content digests and timestamps. Private evidence remains offchain.
3. Verifier sees the accepted criteria, evidence version, worker allocation, own fee, and deadline.
4. Verifier either requests changes or approves completion. “Request changes” records feedback without releasing funds and permits a new submission.
5. Before signing approval, the UI states the exact payment effect and that a later correction does not claw back settled funds.
6. Successful approval atomically credits worker and verifier allocations. Repeated approval cannot pay twice.
7. All parties receive a receipt containing the milestone, evidence digest, signer, amount breakdown, and transaction reference.

Payer-approved milestones follow the same journey with the payer as approver and no verifier fee.

### 5.3 Withdraw earnings

1. Earner or verifier sees “Available to withdraw” separately from funds still reserved for work.
2. They authenticate and confirm withdrawal to their own bound account or an explicitly confirmed destination they control.
3. Sponsored submission removes the need to buy gas. Pending, succeeded, rejected, and failed states remain distinct.
4. A failed transfer rolls back accounting. Retry cannot withdraw the same allocation twice.
5. In the baseline demo, success means stablecoins arrived at the destination account. It does not mean naira reached a bank.

Claim links open an authenticated balance view. They are not bearer instruments. Earned money never expires because a link expires or a user does not immediately withdraw.

### 5.4 Cancel or expire an agreement

Before activation, the payer can discard a draft. A funded milestone cannot be unilaterally cancelled before its deadline: worker and payer must agree to cancellation of its unused allocation. Cancellation invalidates pending approvals for that milestone and preserves earned balances.

At or after an unearned milestone’s expiry, its reserved allocation becomes refundable to the payer. Approval is valid strictly before expiry. Refunding is permissionless to trigger but always pays the recorded payer; the caller cannot choose a recipient. Earned funds remain available to their beneficiaries indefinitely.

Each milestone has a work submission deadline and a later approval expiry, providing an explicit inspection window. The earner is warned that submission alone does not earn payment. If the verifier disappears, parties can mutually replace them before expiry; otherwise the contractual expiry applies. No support agent can manufacture an approval.

### 5.5 Correct a mistaken attestation

A verifier may publish a linked correction with a reason. Original and correction remain visible. It changes the displayed status of the record, not past financial allocations. The app must say “Corrected attestation” rather than “Reversed payment.” External resolution or a voluntary new payment is outside the escrow’s automatic allocation rules.

## 6. Payment model and state transitions

### Accounting invariant

For each agreement, all values use integer token base units:

`total deposited = reserved unearned + earned unwithdrawn + refundable unused + total withdrawn + total refunded`

The contract’s token balance must cover all outstanding liabilities across agreements. No operation can spend an amount allocated to another agreement, beneficiary, or milestone.

- Approval moves the milestone’s worker amount and verifier fee from reserved to earned.
- Withdrawal moves a beneficiary’s earned amount to total withdrawn.
- Cancellation/expiry moves eligible unused funds from reserved to refundable.
- Refund moves refundable funds to total refunded.
- There is no transition from earned to reserved or refundable.
- Fees are funded in advance. There is no hidden deduction from the worker’s advertised amount.

### Example

A payer deposits 3,090 units: three milestones of 1,000 for the builder plus 30 each for the verifier. After milestone one is approved, 1,000 is earned by the builder, 30 by the verifier, and 2,060 remains reserved. The payer cannot reclaim the 1,030 earned allocation. If both remaining milestones expire unearned, only 2,060 becomes refundable. Withdrawing the 1,030 later remains possible.

### State model

| Entity | States | Important transitions |
|---|---|---|
| Agreement | Draft, Awaiting acceptance, Awaiting funding, Active, Settled | Settled only when no reserve or outstanding payable/refundable balances remain |
| Milestone | Pending work, Submitted, Changes requested, Earned, Cancelled, Expired | Earned/Cancelled/Expired are mutually exclusive terminal financial outcomes |
| Transaction | Awaiting signature, Submitted, Confirmed, Failed, Unknown | Unknown requires reconciliation before retry |
| Attestation | Original, Corrected | Corrections append history without rewriting allocations |

Submission and changes-requested statuses are application workflow states. Contract financial state is authoritative. The UI must reconcile the two without inferring payment from a database status.

### Changes and additional funding

Amounts, release authority, deadlines, fee allocations, and acceptance criteria are immutable for a funded milestone. A material change uses a versioned replacement accepted by payer and earner, plus the verifier when their responsibilities change. Only unused reserve can move into the replacement; old signatures become invalid. The simplest v1 implementation cancels unused allocations by mutual consent and creates a new agreement. New work requires new funding and acceptance.

### Time accrual (P1)

Time agreements are separate from milestone agreements in v1. Both parties accept a total budget, start time, end time, and payer cancellation right. Earned amount is calculated from elapsed time when read or transacted; the product does not submit a transaction every second. Integer rounding never awards more than the funded budget, and completion releases any final rounding remainder. Cancelling checkpoints earnings at the cancellation timestamp, stops future accrual, and returns only the unearned remainder. The increasing display is an estimate until chain reconciliation.

## 7. Functional requirements and acceptance criteria

| ID | Requirement | Acceptance criteria |
|---|---|---|
| ACC-01 | Account and role binding | Wrong account cannot approve, withdraw, or accept another participant’s role; forwarded link alone is insufficient |
| ACC-02 | Versioned acceptance | Every required party accepts the same terms digest; any draft edit invalidates earlier acceptance |
| ACC-03 | Funding | Actual received amount equals required reserves; unsupported/fee-on-transfer tokens are rejected; duplicate retries do not create duplicate agreements |
| ACC-04 | Evidence | Only authorized parties can view private files; verifier signs the submitted version’s digest; later upload does not replace signed evidence |
| ACC-05 | Approval | Only designated authority can approve a valid, unearned, unexpired milestone; transaction credits both beneficiaries atomically |
| ACC-06 | Earned protection | Payer, verifier, support operator, and expiry path cannot reclaim earned funds |
| ACC-07 | Withdrawal | Only beneficiary authorization can move their balance; failed token transfer leaves balance intact |
| ACC-08 | Refund | Refund excludes earned allocations and pays only payer; approval/refund race can produce only one financial outcome |
| ACC-09 | Mutual cancellation | Both valid signatures bind agreement, milestone, nonce, deadline, chain, and contract; replay and stale cancellation fail |
| ACC-10 | Corrections | Correction links original attestation and identifies signer; amounts and original evidence digest remain unchanged |
| ACC-11 | Sponsorship | First-time worker and verifier complete P0 without gas balance; rejected sponsorship produces clear retry/support path |
| ACC-12 | History | Confirmed activity matches contract events; stale index data is labeled and reconciled |
| ACC-13 | Receipts | Every financial receipt contains token, network, amount, recipient, time, and transaction reference |
| ACC-14 | Access recovery | Provider-supported recovery preserves account binding; support cannot replace a funded beneficiary through a database edit |
| ACC-15 | Deployment disclosure | Users and judges can identify testnet, test token, simulated bank payout, and actual transaction status |
| ACC-16 | Terminal settlement | Agreement closes only after reserves and outstanding balances reach zero; archived UI does not remove withdrawal access |

## 8. Screens and interaction requirements

| Screen | Required information and actions |
|---|---|
| Landing | One-sentence value, three-role example, create/join agreement |
| Onboarding | Sign-in, supported account creation/recovery, participant identity confirmation |
| Dashboard | Separate paying, earning, and verifying tabs; reserved/earned balances and pending tasks |
| Agreement builder | Participants, conditions, milestones, evidence checklist, dates, full fee breakdown |
| Agreement review | Accepted version, who can release funds, cancellation/expiry explanation, accept/fund |
| Agreement detail | Funding status, allocation summary, next action, milestone list, timeline |
| Evidence submission | Checklist, upload progress, drafts, submission version, resubmit |
| Inspection | Criteria and evidence side by side; request changes or approve with payment confirmation |
| Earnings | Available balance, history, withdrawal destination and status |
| Receipt | Human-readable allocation breakdown and optional technical details |
| Verifier record | Verified allocations, number of attestations, corrections and reported concerns; methodology disclosure |
| Support/status | Action identifier, readable error, retry eligibility, latest synchronized state |

Use “Reserved for work,” “Available to withdraw,” and “Returned to payer.” Do not call a wallet balance a bank balance. Default UI hides token addresses and transaction jargon behind details while preserving exact token/network disclosure at funding and withdrawal.

Mobile layouts must work at 360px width without horizontal scrolling. Controls need accessible labels, visible focus, sufficient contrast, and non-color status indicators. Never require Face ID specifically; support the selected provider’s available authentication methods. Slow-network users retain evidence drafts, see upload progress, and cannot accidentally submit duplicate payments.

## 9. Architecture and data

### Proposed components

- Responsive Next.js application/PWA for all roles.
- NestJS API for agreement drafts, invitations, evidence access, notification delivery, and reconciliation jobs.
- PostgreSQL for application records and indexed views.
- Solidity payment contracts on Monad; non-upgradeable v1 financial core with no administrator function to redirect balances.
- One embedded wallet provider, selected after an integration spike; SDK versions and account architecture pinned after validation.
- Restricted transaction sponsor/paymaster or equivalent supported provider flow.
- Envio candidate indexer for event projections; direct RPC checks before presenting consequential balance state.
- Private object storage for evidence; content digests and decision references recorded with attestations.

Backend service keys cannot approve milestones or withdraw for users. Users authorize actions through their bound accounts. No seed phrases or private wallet keys are stored in Accrue’s application database.

### Principal records

| Record | Important fields |
|---|---|
| User/account | App ID, provider subject, bound account, recovery metadata, notification preferences |
| Agreement | ID, chain, contract, token, payer, earner, verifier, version, terms digest, funding reference |
| Milestone | Agreement ID, sequence, worker amount, verifier fee, approver, submission deadline, expiry, criteria digest |
| Acceptance | Participant, role, terms version/digest, signature or transaction, timestamp |
| Evidence package | Milestone, version, private file references, content digests, submitter, manifest digest |
| Attestation | Milestone, signer, evidence digest, transaction, allocations, optional correction reference |
| Transaction operation | Idempotency key, intent, actor, chain transaction hash, nonce/status, last reconciliation |
| Event projection | Chain, block hash/number, transaction hash, log index, decoded event, confirmation status |
| Concern report | Reporter, agreement relationship, referenced attestation, statement, visibility and status |

Do not place personal names, addresses, construction locations, photos, or raw documents onchain. Explain that public account addresses and payment events remain publicly observable. Evidence deletion can remove stored files but cannot erase published digests. Retention is disclosed before upload; prototype evidence should use consented or synthetic material.

### Contract capabilities

Create/fund an accepted agreement; approve milestone; withdraw earned balance; execute mutual cancellation; mark expired reserve refundable; refund payer; append correction; read allocations. P1 adds bounded time accrual and fixed collaborator splits.

All signed actions bind chain ID, contract address, agreement/version, action payload, nonce, and expiration. Token transfers follow checks-effects-interactions with reentrancy protection and safe return-value handling. Tests must cover smart-account signature validation if the selected account architecture uses it.

### API responsibilities

Expose authenticated draft creation/editing, invitations, acceptance preparation, authorized evidence upload/download, evidence submission, operation status, timeline, and receipts. Financial action endpoints prepare or relay user-authorized transactions; an HTTP success never independently marks a payment confirmed. Mutating requests use idempotency keys. Invitations expire and are revocable until accepted; accepted financial identities require the agreement change process.

## 10. Reliability, security, and operational behavior

- Disable duplicate action buttons while pending, but reconcile transaction status before permitting retries after a timeout.
- Rebuild index projections from chain events; uniquely identify events by chain, transaction hash, and log index, and handle changed block hashes according to the network policy.
- Restrict sponsorship by account, action selector, target contract, rate, and daily budget. Do not sponsor arbitrary transactions.
- Validate file types and sizes; reject executable content, scan uploads where available, and use short-lived authorized download links.
- Support and application administrators may stop new app submissions or sponsorship during incidents. They cannot pause an already earned beneficiary withdrawal at the contract layer or seize funds.
- With sponsorship unavailable, advanced users may submit directly if they can pay gas. Ordinary users receive an accurate outage explanation.
- With the website unavailable, published contract information and a documented alternative withdrawal procedure preserve practical access to earnings.
- With a compromised verifier account, parties can mutually replace authority for unearned milestones. Past allocations remain unchanged.
- A correction count or concern count is not a proven fraud count. Raw activity can be fabricated through collusive agreements; no aggregate “trust score” is shown.

### Performance targets (to measure, not advertise as achieved)

Mobile core pages usable within 3 seconds under a representative constrained-network test; local interaction feedback within 200ms; transaction submission acknowledged within 2 seconds of provider response; confirmed settlement reflected within 5 seconds of observing the network receipt. Show progress if any threshold is exceeded. Never promise fixed network finality based on an animation.

## 11. Sponsor and competition strategy

Track 2 is the only category targeted. Sponsor bounties are competitive opportunities subject to current rules; integration alone does not earn an award. Do not publish the previous “$48k exposure” total: its basis is inconsistent, and award stacking has not been verified.

| Candidate | Product role | Required evidence | Gate before claiming eligibility |
|---|---|---|---|
| Agora | Stablecoin funding and cross-border settlement | Real supported-token deposit, allocation, and withdrawal; corridor story and balance receipts | Confirm required token, chain, category, and whether testnet/sandbox flows qualify |
| Privy OR Dynamic | Embedded accounts and signing | New worker/verifier onboarding and sponsored interaction on actual demo devices | Validate provider support, account recovery, gas flow, and exact bounty conditions; choose one |
| Envio | Payment timeline and verifier activity | Reproducible event indexing and matching UI | Confirm supported deployment and bounty requirements |
| Chainlink CRE | Optional evidence-manifest validation | Workflow fetches an authorized manifest, validates structure/digests, and produces a verifiable result consumed by the app | Validate network/runtime support and eligible output path; never claim it proves physical completion |
| Alchemy | Optional RPC or account infrastructure | Demonstrable necessary infrastructure use | Add only if compatible with chosen account stack and current bounty |

The mandatory sponsor-oriented work is a functioning payment and onboarding path. CRE must not delay that path. If implemented, it validates evidence handling while the human verifier remains responsible for the inspection decision.

Before submission, create a rules checklist with the official portal’s exact deadline and timezone, team/country eligibility, permitted network, prior-work disclosure, submission requirements, each bounty’s rubric, and stacking rules. Save dated source links or permitted screenshots. Current public listings conflict on some prize figures; the portal/organizer rules must resolve those figures.

## 12. Demo and submission

### Three-minute demonstration

1. **0:00–0:20:** “A client abroad is renovating a home in Lagos. The builder needs guaranteed funding. Their agreed engineer checks each milestone.” Show the three participants and amounts.
2. **0:20–0:50:** Open an accepted agreement, fund it with the supported token, and show confirmed reserves on both devices.
3. **0:50–1:30:** Builder submits foundation evidence; engineer reviews the criteria and signs. Worker and verifier balances update together.
4. **1:30–1:55:** Builder withdraws using an embedded account with sponsored gas. Show the actual receipt.
5. **1:55–2:20:** Demonstrate that reclaiming earned money fails through a prepared test interaction. Then show a legitimate refund of unused expired funds. Keep the normal consumer interface free of a knowingly invalid “steal back” button.
6. **2:20–2:40:** Open the payment timeline and verifier’s attestation record. Explain what the record establishes and what it does not.
7. **2:40–3:00:** Show sponsor integrations, deployment details, and explicit demo limitations. Close on the user benefit.

Time streaming is an optional separate demonstration after the core flow. The construction journey does not earn funding merely because a timer runs unless the parties explicitly chose that contract type.

### Submission deliverables

Working URL, demo accounts/instructions, reproducible source and deployment instructions, contract addresses and network, tests and results, video, architecture overview, integration evidence, and a short disclosure of simulated components and any reused code. Confirm the actual required video length and repository visibility from current rules.

## 13. Measurement and release acceptance

### Product validation targets

- Five representative testers can explain all three roles after the introduction.
- At least four of five complete their assigned role without facilitator intervention.
- Every tester understands that “earned” and “withdrawn” are different, and that expiry only returns unused funds.
- Collect at least three payer and three worker/verifier conversations about milestone criteria, fee incentives, cancellation, and cash-out expectations. These are research targets, not claimed traction.

### Instrumentation

Track invitation opened, acceptance completed, funding submitted/confirmed, evidence submitted, inspection changes requested, approval confirmed, withdrawal confirmed, refund confirmed, and error/retry events. Measure completion rate, time to first funded agreement, verification turnaround, withdrawal completion, index delay, and sponsored-gas cost. Avoid logging evidence contents, secrets, or complete authentication tokens.

### Required verification

| Test group | Critical cases |
|---|---|
| Accounting properties | Conservation after arbitrary valid action sequences; no undercollateralization; no cross-agreement spending |
| Permissions/signatures | Wrong signer, wrong chain/contract, stale version, replay, expired signature, forwarded invitation |
| Financial boundaries | Double approval, double withdrawal, exact expiry boundary, approval/refund race, fee rounding, failed token transfer |
| Changes | Cancellation after earning, changed verifier, stale approval after replacement, partial agreement completion |
| Integration | New embedded accounts, signature rejection, no gas balance, sponsor outage, RPC outage, index delay |
| UX | Mobile widths, keyboard navigation, slow upload, refreshed pending transaction, readable fee/expiry consent |
| Recovery | Backend restart, replay index, unavailable evidence, account recovery, direct withdrawal procedure |

Release acceptance requires the full P0 journey on actual devices, passing invariant/authorization tests, ten consecutive successful rehearsals without manual database edits, and complete visibility into live versus simulated components. Testnet success does not constitute production financial readiness.

## 14. Delivery plan and team responsibilities

### First 48 hours: working vertical slice

| Stage | Builder A: contracts/integrations | Builder B: product/application | Exit condition |
|---|---|---|---|
| Hours 0–4 | Validate token, account signatures, sponsorship; specify invariants | Agreement screens, role flows, accepted terms model | Funding/signing spike works; decisions documented |
| Hours 4–16 | Core escrow, approval, withdrawal, expiry/refund tests | Draft/acceptance, evidence, three role views | Local end-to-end scenario passes |
| Hours 16–30 | Deploy, verify, connect sponsor and indexer | Wire real actions, receipts, pending/error states | On-network P0 flow works |
| Hours 30–48 | Adversarial tests and transaction reconciliation | Actual-device QA, demo data, walkthrough | Reviewable prototype with known issues |

The 48-hour target is a prototype milestone. Remaining hackathon time goes toward correcting failures, validating users and sponsor rules, optional P1 work, and submission polish. Do not add P1 features while accounting, permissions, or core onboarding remain broken.

### Following milestones

1. P0 hardening: failure recovery, evidence authorization, full acceptance suite.
2. Sponsor verification: obtain exact rubrics; complete only integrations that contribute to the demo.
3. User validation: revise language and consent based on observed confusion.
4. P1: time template, collaborator splits, CRE or payout adapter in that order only as priorities warrant.
5. Submission freeze: rehearse, publish required artifacts, submit with a buffer before the verified deadline.

## 15. Business hypothesis and roadmap

Initial distribution is through diaspora renovation communities and existing professionals who coordinate projects. One professional can introduce both sides of an agreement, reducing the need to bootstrap an open marketplace.

Hackathon platform fees are zero; verifier fees are explicit. A future commercial model could charge per funded agreement or for professional workspaces. Pricing is unvalidated and must be tested against willingness to pay, settlement costs, dispute handling, and provider costs before choosing a rate.

Later releases may add paid inspection reports regardless of verdict, provider-backed cash-out, multi-verifier approvals, appeal windows before earning, identity checks, professional discovery, and bonded verification. Any appeal window changes the definition of when money is earned and must be implemented as an explicit pre-earning state. Slashing needs a credible adjudicator and is not itself a solution to deciding truth.

## 16. Decisions resolved from the earlier draft

| Earlier ambiguity | Decision in this PRD |
|---|---|
| Track 4 crossover | Removed from positioning and delivery objectives |
| Unclaimed earned funds expire to payer | Prohibited; only unused reserve expires |
| Payer can change future terms unilaterally | Funded milestone changes require mutual agreement |
| Verifier verifies without evidence storage | Versioned private evidence and signed digest are P0 |
| Attestation record equals reputation staked | Record is attributable history; no economic bond or verified trust claim |
| Wrong attestation can be corrected | Append correction; no automatic payment reversal |
| Three rules mixed in construction demo | Milestone story first; time agreements are a separate P1 template |
| No-wallet claim link | Authenticated access to bound account; never bearer access to money |
| Fiat receipt implied by stablecoin withdrawal | Stablecoin and bank payout statuses are separate |
| Prize exposure presented as total | Removed pending verified prize values and stacking rules |

## 17. Sources and verification notes

- Product input: user’s Claude conversation, “Metropolis Build Brief,” and “Accrue PRD v0.2,” including the eight-page PDF saved on 9 September 2026. This document replaces conflicting product decisions in v0.2. The “Accrue, Simply” artifact was not fully inspected and is not relied upon as a requirements source.
- [Official application portal](https://hackathon.monad.xyz/): controlling source to inspect for current submission and sponsor rules. Search indexes returned stale content during this drafting pass.
- [Monad announcement](https://www.linkedin.com/company/monad-network): current indexed announcement identifies Metropolis, its four tracks, and named sponsors. It does not establish each sponsor’s acceptance requirements.
- [Metropolis partner listing](https://www.risein.com/monad/monad-metropolis-hackathon): lists the September–October build period and November announcement schedule; exact timestamp/timezone must be checked in the portal.
- [Monad/Encode London event](https://luma.com/metropolis-lon-oct-2026): corroborates the consumer payments track but differs from other listings on overall-winner prize value. No prize total is adopted from it.
- [Monad onramp overview](https://blog.monad.xyz/blog/monad-onramp-ecosystem): explains the role of regional coverage and payment methods. It is not proof that any provider supports this proposed corridor or user type.

Sponsor token addresses, SDK versions, gas sponsorship support, CRE deployment support, and cash-out coverage remain explicit integration gates. Implementation must verify them against current official provider documentation before locking dependencies or claiming eligibility.

