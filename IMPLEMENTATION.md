# How Accrue is built

What runs today, where each piece lives, what the server can and cannot do
with your money, and what is still missing before this could hold real funds.
Checked against the code and the live deployment on 1 October 2026. The
sandbox-era version of this document is kept, for history, at
[docs/planning/IMPLEMENTATION-SANDBOX.md](./docs/planning/IMPLEMENTATION-SANDBOX.md).

## At a glance

| Layer | What it is | Where |
|---|---|---|
| App | Next.js App Router on Vite ([vinext](https://github.com/cloudflare/vinext)), one responsive PWA for phone and desktop | `app/`, `components/` |
| Hosting | Cloudflare Workers, with D1 (SQLite) and R2 | [accrue.accrue-escrow.workers.dev](https://accrue.accrue-escrow.workers.dev), [DEPLOY.md](./DEPLOY.md) |
| Accounts | Mera passkeys. One ceremony, keys derived from the passkey's PRF output, no seed phrase, no extension, no custody backend | `lib/mera-account.ts`, `app/wallet-context.tsx` |
| Network and money | Monad testnet (chain 10143), Agora's AUSD (6 decimals) | `lib/chain.ts`, `lib/ausd.ts` |
| Milestone escrow | `AccrueEscrow`: staged payments, each released by the client or a reviewer both sides named | `contracts/src/AccrueEscrow.sol`, `lib/escrow.ts` |
| Proof-checked escrow | `AccrueDigitalWork`: one deliverable, three named verifiers, two of three votes settle | `contracts/src/AccrueDigitalWork.sol`, `lib/digital-work-chain.ts` |
| Proof Engine | Deterministic public checks, an AI reading of the brief, and a locked policy that decides whether it votes | `lib/proof-checks.ts`, `lib/jev-verifier.ts`, `lib/digital-work-policy.ts` |
| History | Envio HyperSync (payment history, escrow activity) and HyperRPC (range reads the public RPC refuses) | `app/api/history`, `app/api/escrow-activity` |
| Gas | A narrow sponsor pays a new account's first network fees and its test-AUSD claim | `app/api/sponsor` |
| Names | `@name` tags, claimed by signing with the account that owns them | `app/api/tags` |

## Accounts: one passkey, three keys

Creating an account is one WebAuthn ceremony with the PRF extension. The
passkey's 32-byte PRF output never leaves the device and is the same every time
the same passkey is used, so it seeds a BIP-32 tree: client, worker and reviewer
keys sit at `m/44'/60'/0'/0/{0,1,2}`. Nothing is stored server side. Clearing
browser storage, or opening the app on another device that holds the passkey,
reconstructs the same accounts and the same `@name`. That is the Mera "stateless
test", and it is in [VERIFICATION.md](./VERIFICATION.md).

Keys live in a Mera signing session for 15 minutes and are then discarded; the
app warns two minutes before and offers "Stay signed in". In product mode a
passkey is one person with one account. The guided walkthrough switches on all
three, so one visitor can play every side of a real job on one device. Each
role signs with its own key and the contract sees three unrelated addresses, so
this is not a role switch pretending to be authorization.

A localhost-only developer sign-in exists for driving the app without a passkey
prompt. It refuses to run in a production build or on any other host.

## The money path

Both escrows are non-upgradeable, bound at construction to AUSD, and have no
administrator function that can move a balance.

- **Terms are fixed by hash before money moves.** Every party accepts the same
  terms hash, and funding is refused until all have.
- **Approval pays worker and reviewer in one transaction.** A second approval
  cannot pay twice, and earned money cannot be clawed back by the client,
  by expiry, or by anyone else.
- **Withdrawals are pulls by the beneficiary,** to their own address.
- **Only unearned money returns to the client,** on expiry or mutual
  cancellation.

### Which contract version is deployed

| Contract | Address on Monad testnet | Built from |
|---|---|---|
| `AccrueEscrow` (v1) | [`0xf8c44A529cd0470597C7865d2B2473abff65d0De`](https://testnet.monadvision.com/address/0xf8c44A529cd0470597C7865d2B2473abff65d0De) | commit `38999ea`, source verified on MonadScan |
| `AccrueDigitalWork` (v1) | [`0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07`](https://testnet.monadvision.com/address/0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07) | commit `c1abd65` |

On 1 October both were rebuilt from those commits and compared with the
on-chain code: identical length, identical bytes apart from the metadata hash
and the immutable token-address slots.

`contracts/src` now holds **v2** of both, merged on 30 September and covered by
the Foundry suite, but **not yet deployed**. v2 is about silence not being a
no. In milestone jobs, each submission gets a five-day review window; if the
approver neither approves nor sends it back in time, anyone can release that
milestone to the worker. In proof-checked jobs, evidence submitted on time is
paid at the review deadline unless two verifiers voted fail, and either party
can call off an unfunded job (a funded one needs both). The app reads
`rulesVersion()` on each contract and acts
on every job at the contract it was created on, so switching to v2 is
`node scripts/deploy-v2.mjs --confirm`, setting the two new addresses, and a
redeploy. Existing jobs stay on v1.

## Payments, history and Agora

- **Direct sends.** The Send page pays an `@name` or an address in AUSD. The
  transfer is an ordinary token transfer signed by the passkey account; the app
  reports "Confirmed on Monad in N ms" with the network fee for every
  transaction it sends.
- **History.** The public RPC caps log queries at 100 blocks, so an account's
  past payments cannot be recovered from it. Envio HyperSync answers over the
  whole chain in one request, for AUSD transfers to and from an account and for
  activity on both escrows. Without an Envio token the app shows only what it
  recorded itself, and says so.
- **Agora.** AUSD's live supply (total, and on Monad) comes from Agora's public
  metrics API, so the app can say what AUSD is rather than assert it. Cash-out
  to a bank account is built against Agora's Routes API but needs an
  organisation key, a verified bank account and an approved wallet
  entitlement; without them it reports itself unconfigured.

## Proof Engine

For a proof-checked job the client locks one of three checkable deliverables:
a public web page on an agreed site that contains agreed text, a GitHub pull
request from the worker's named GitHub login, opened after the job was written
and merged into the agreed repository, or an API that returns an agreed status
and JSON value. When the
worker submits:

1. **Deterministic checks** run against the public evidence. A check that
   could not run (timeout, rate limit, a 5xx) makes the engine abstain rather
   than vote fail.
2. **An AI reading** of the brief and the check report returns two
   probabilities: that the requirements are met, and that a human should look.
   The provider is BeatAPI `jev-1.13-free` when a key is set, otherwise
   Cloudflare Workers AI `typesafe/jev`; the model and provider are shown in
   the report.
3. **The locked policy decides.** It votes pass only when every check passes
   and the AI reports 90% or more requirements confidence with at most 10% need
   for human review. It votes fail when a check fails or the confidence is 10%
   or less. Anything else, including a check that could not run, is an
   abstention with its reasons. Its vote is one of three; the two named human
   reviewers decide what it cannot.

The engine's vote is signed by a dedicated testnet key that can only vote on
jobs naming it as a verifier. Recorded job #6 shows the abstain path: 94%
confidence, 15% review need, so the two humans decided.

## Server side, and what it can and cannot do

The server is Next route handlers on a Worker. D1 holds the readable side of
each job (titles, scopes, criteria, policies, manifests, messages, offers,
reviewers, tags); the contracts hold only hashes of those, so the readable
terms and the enforced terms are provably the same agreement.

What the server **cannot** do: approve a milestone, cast a reviewer's vote,
withdraw for anyone, or move escrowed money. Those are transactions signed by
the participant's own passkey account.

What the server's keys **can** do:

- The **sponsor key** calls one function on the known AUSD faucet, or sends a
  small fixed amount of test MON, to the signed-in account. It never takes an
  arbitrary transaction or target, and is capped per account.
- The **Proof Engine key** votes only on jobs that name its address.

Access to someone else's job (its readable terms, messages and verification
record) is granted by a signature from an address the job names, checked with
`verifyMessage`, never by a forwarded link alone. Tags are claimed the same
way. Identity for the app's own records (the payments it recorded, evidence
files) is the request's origin on the standalone deployment, which is weaker
and fine for test money only.

Private evidence uploads go to R2 with SHA-256 digests; a file can be read back
only by the account that stored it.

## Live, simulated, or not built

| Capability | State |
|---|---|
| Passkey accounts, stateless reconstruction | Live |
| AUSD sends, balances, test-AUSD claim | Live, testnet |
| Milestone escrow: accept, fund, submit, approve, send back, withdraw, cancel, refund | Live, testnet, v1 rules |
| Proof-checked escrow and Proof Engine | Live, testnet, v1 rules |
| v2 rules (pay on silence, review window) | In source and tested; not deployed |
| Gas sponsorship for new accounts | Live, testnet, narrow |
| Envio HyperSync history and activity | Live |
| Hiring links, job board, reviewer pool, verified-work profiles, job messages | Live |
| Installable PWA | Manifest and icons as of 1 October; no offline mode, by design, since balances must come from the chain |
| Notifications | In-app only, while the app is open |
| Bank cash-out via Agora | Built, unconfigured: needs Agora organisation access |
| Native mobile app | Not built; the PWA is the mobile surface |

## Before this could hold real money

1. An independent audit of both contracts, v2 included.
2. A sponsor with budgets, quotas and monitoring rather than a testnet cap.
3. Account recovery tested on real devices and authenticators, and a
   documented way to withdraw if the website is gone.
4. Server identity for app records bound to a signed session rather than the
   request origin.
5. Evidence retention, deletion and malware scanning, and a privacy review.
6. Notifications that reach people when the app is closed.
7. Mainnet AUSD (`0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`) only after all
   of the above.

Test money on a test network. Nothing here is audited.
