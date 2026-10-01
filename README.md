# Accrue

**Hire for digital work. Pay when it's proven done.**

Remote hiring runs on trust nobody can check. The client pays upfront and
hopes, or holds back and good people walk away. The worker starts before
knowing the money exists. A marketplace in the middle holds both sides'
money and settles disputes on its own schedule.

Accrue replaces the middle with a contract. The client locks the pay in
escrow on Monad before work starts, so the worker can see it is there. The
terms, including what counts as done, are fixed by hash and accepted by
everyone before a cent moves. Payment releases when the work is approved,
and the client cannot claw back what has been earned. Anything never earned
goes back to the client.

Built for **Monad Metropolis, Track 2: Consumer Products & Payments.**

**Try it:** [accrue.accrue-escrow.workers.dev](https://accrue.accrue-escrow.workers.dev)
(on a phone, "Add to Home Screen" installs it as an app) · a judge's
three-minute path is in [DEMO.md](./DEMO.md) · how it is built is in
[IMPLEMENTATION.md](./IMPLEMENTATION.md).

## Two escrow flows

| | Proof-checked job | Milestone job |
|---|---|---|
| For | One deliverable with a checkable result | A bigger project paid in stages |
| Who approves | Proof Engine plus two named reviewers; two of three pass votes pay | The client, or a reviewer both sides name, approves each stage |
| What is checked | A live web page containing agreed text, a GitHub pull request merged into the agreed repo, or an API returning agreed data | Each stage's written done-criteria |
| Contract | [`AccrueDigitalWork.sol`](./contracts/src/AccrueDigitalWork.sol) | [`AccrueEscrow.sol`](./contracts/src/AccrueEscrow.sol) |

**Proof Engine** first runs checks that cannot be argued with (does the page
load and say what was agreed, is the pull request merged, does the API answer
correctly), then asks an AI model whether the evidence meets the brief. It
votes only when it is confident: pass at 90% or more with little need for
human review, fail if a check breaks. Anything in between goes to the human
reviewers, with the reason in the report. On the recorded testnet job #6 it
abstained, and two reviewers decided.

## What a first visit looks like

- **The landing page** (`/`) tells the story, with four scenarios traced
  payout by payout, three illustrative and one real (job #6).
- **Home** (`/app`) is one list of what needs you across both escrows:
  accept, fund, deliver, review, withdraw. It also shows what you are waiting
  on, your balances, and a setup checklist for new accounts.
- **Hiring links.** Both contracts fix the worker at creation, so a client
  could only hire someone whose @name they knew. Now a client can write the
  job without a worker and share a link. Whoever takes it shows up on the
  client's Home, and the job form comes pre-filled for them.
- **The walkthrough.** One passkey derives a client, a worker and a reviewer
  account, and a guided run takes a single visitor through a real milestone
  job from all three sides in about three minutes.

## What is real

Running on **Monad testnet** with **AUSD**, Agora's dollar stablecoin.

| | |
|---|---|
| Accounts | **Mera** passkeys. One ceremony, no seed phrase, no extension, no custody backend. |
| Money | **AUSD** transfers settling in about a second, held in escrow contracts until work is approved. |
| Milestone escrow | [`0xf8c44A529cd0470597C7865d2B2473abff65d0De`](https://testnet.monadvision.com/address/0xf8c44A529cd0470597C7865d2B2473abff65d0De), bound at construction to AUSD. v1 rules, built from commit `38999ea`. |
| Proof-checked escrow | [`0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07`](https://testnet.monadvision.com/address/0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07), v1 rules, built from commit `c1abd65`; see [docs/DIGITAL-WORK.md](./docs/DIGITAL-WORK.md). |
| Next contract version | `contracts/src` holds v2 of both (silence is not a no: an undecided submission can be released to the worker). Tested, not yet deployed; see [IMPLEMENTATION.md](./IMPLEMENTATION.md#which-contract-version-is-deployed). |
| History | **Envio** HyperSync and HyperRPC, for payment history and the activity feed across both contracts. |
| Fees | Sponsored. A new account holds no MON, so the first network fee is paid for it. |
| Names | Payment tags. You pay `@bola`, not a 42-character address. |

Test money on a test network. The contracts have had no independent audit
and must not hold real funds.

## Run it

Node 22.13+. Foundry only for the contracts.

```sh
npm ci
npm run build
```

Apply the migrations in order, once each. On a fresh database the loop below
runs clean. On an existing database, apply only the ones you have not run yet;
`0010_job_offers.sql` adds hiring links, and `0011`–`0012` the reviewer pool,
job board and job messages.

```sh
for m in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --config dist/server/wrangler.json \
    --persist-to .wrangler/state --file "$m"
done
npm run dev
```

Then open the printed loopback URL and sign in with a passkey. No Cloudflare
account is needed to run it locally: Workers AI is bound only when Wrangler is
signed in (or `ACCRUE_REMOTE_AI=1`), and without it Proof Engine still runs its
checks and says the AI review is unavailable.

### Optional configuration

Each of these degrades honestly: without it the app says what it cannot do
rather than failing or pretending. All go in `.dev.vars`, which is gitignored.

| Variable | What it unlocks | Where from |
|---|---|---|
| `ACCRUE_SPONSOR_KEY` | Paying a new account's first network fee, and claiming test AUSD for it | A funded testnet key; `node scripts/deployer.mjs` prints an address, fund it at [faucet.monad.xyz](https://faucet.monad.xyz) |
| `ENVIO_API_TOKEN` | Payment history across the whole chain | [app.envio.dev/api-tokens](https://app.envio.dev/api-tokens) |
| `ENVIO_RPC_TOKEN` | Range reads the public RPC refuses | Same |
| `AGORA_API_KEY` | Cash-out to a bank account via Agora routes | An Agora organisation key; also needs a verified bank account and an approved wallet entitlement |
| `NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS` | Proof-checked jobs (goes in `.env.local`) | The deployed `AccrueDigitalWork`, above |
| `ACCRUE_JEV_VERIFIER_KEY` | Proof Engine's own vote | A new testnet-only key, distinct from sponsor and deployer, holding a little MON for gas |
| `ACCRUE_BEATAPI_API_KEY` | Proof Engine's AI review | [beatapi.io](https://beatapi.io/dashboard/apikeys); or Cloudflare AI via `ACCRUE_CLOUDFLARE_ACCOUNT_ID` and `ACCRUE_CLOUDFLARE_AI_TOKEN` |

Agora's supply metrics need no key and always work.

[.env.example](./.env.example) documents each one. `node scripts/print-env.mjs`
shows what this machine has set, masked; add `--reveal` to print the values
for a secrets manager.

## Verify

```sh
node --test tests/domain.test.mjs tests/chain.test.mjs tests/next-actions.test.mjs tests/proof-checks.test.mjs
npx tsc --noEmit
node tests/api-smoke.mjs                 # needs the dev server
node tests/tags-smoke.mjs                # claim, resolve, forgery, replay
node tests/participant-visibility-smoke.mjs  # who can read a job's terms
node tests/sponsor-smoke.mjs             # needs a funded sponsor key
node tests/chain-live.mjs                # read-only, no key needed
node tests/live-agreement-smoke.mjs      # funds a real testnet job end to end
cd contracts && forge test -vv
```

[VERIFICATION.md](./VERIFICATION.md) records what has actually been run,
including a three-account escrow journey on testnet and the transaction
hashes it produced.

## Reading further

- [Watch the 70-second Proof Engine walkthrough](./videos/accrue-verifiable-work/renders/video.mp4) — actual testnet use from agreement creation through worker withdrawal.
- [Explore the proof trail](./public/demo.html) — an interactive tour of the recorded job.
- [DEMO.md](./DEMO.md) — the walkthrough sequence, source, and on-chain evidence.
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — architecture, security
  boundaries, and what remains before this could handle real money.
- [docs/PRODUCT-REQUIREMENTS.md](./docs/PRODUCT-REQUIREMENTS.md) — the product
  specification this was built against.

## What this does not do

Proof Engine checks facts (a page says X, a pull request is merged, an API
answers Y) and an AI's reading of the brief; it does not judge taste, and
two named people settle what it cannot. Their votes are a record, not a
trust score. Notifications reach people only while the app is open. It does not reach
a bank account. It is not audited. Payment tags resolve through Accrue's own
directory, so a tag stops resolving if the app goes away, though the account
behind it keeps working.

The product is more convincing with those stated than without.
