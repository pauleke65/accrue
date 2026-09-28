# Accrue digital work

Accrue now has a digital-work agreement separate from the older construction milestone escrow. The first job type is a deployed JSON API. A payer fixes the acceptance policy and three verifier addresses before funds move. The worker accepts those terms, the payer locks AUSD, and the worker pins a GitHub commit plus a deployment URL. Two matching verifier votes decide settlement. Jev is one invited verifier; it never settles a job alone.

## Scope

The build implements six features across three of the original five directions:

| Direction | Implemented feature |
| --- | --- |
| Verifiable work protocol | Locked API policy, explicit worker acceptance, funded reward and verifier pool |
| Verifiable work protocol | Versioned, hashed evidence manifest and bounded public endpoint checks |
| Verifier network | Three distinct invited verifiers with 2-of-3 pass/fail quorum |
| Verifier network | Verifier fees, correction requests, expiry refund, and pull withdrawals |
| Autonomous work economy | Proof Engine automated reviewer with typed AI evaluation and an on-chain vote when the policy permits |
| Autonomous work economy | Wallet-authenticated routes usable by human or agent participants |

This release does not include a general verifier marketplace, reputation graph, or recurring SLA contracts.

## Live testnet proof

The [70-second narrated walkthrough](../videos/accrue-verifiable-work/renders/video.mp4) records the product in use for job `#6`: create, accept, fund, submit, run Proof Engine, collect two signed reviewer votes, settle, and withdraw. The [interactive proof page](../public/demo.html) lets readers inspect each step. Its [source composition and narration](../videos/accrue-verifiable-work/) are editable. The underlying AI returned 94% requirements confidence and 15% human-review need, so Proof Engine abstained under the locked 10% review limit. A fresh contract read confirmed status `Paid`, two pass votes, zero fail votes, and zero remaining worker claimable balance. Distinct verifier addresses were used for the demo; the recording does not establish separate human operators.

- Contract: [`0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07`](https://testnet.monadvision.com/address/0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07)
- Deployment: [`0x676033…faa08f5fa`](https://testnet.monadvision.com/tx/0x6760331451ff48ea1aecc41bbc4d9c345f4a12330ddcb0689aef22dfaa08f5fa)
- Job `#6`: worker reward 5 AUSD, verifier pool 0.30 AUSD, two pass votes from distinct verifier addresses.
- Deciding vote and settlement: [`0x3575e2…903cc`](https://testnet.monadvision.com/tx/0x3575e2f43cadefc4c24d997b7f87df8767157da587871bfac518c868f8f903cc)
- Worker: [`0x481A…65b7`](https://testnet.monadvision.com/address/0x481A9deE8B9A2dB6C703DF85b41912D5c97B65b7)
- Public endpoint: [Cloudflare Worker `/health`](https://accrue-verifiable-work-demo.pauleke65.workers.dev/health)
- Readable showcase: [`/demo.html`](../public/demo.html)

The automated checks prove that the submitted public commit exists and the deployment responds with the locked HTTP status and JSON value. They do **not** prove that the deployment was built from that commit. Independent reviewers remain responsible for that assessment. This is a material boundary of the API-task prototype.

## Proof Engine provider

Proof Engine is Accrue's branded verification flow. It combines deterministic public checks, an AI assessment, and a policy decision. The AI provider is disclosed in the technical record; Accrue does not claim to own the underlying model. The verifier Worker prefers BeatAPI `jev-1.13-free` when `ACCRUE_BEATAPI_API_KEY` is set. It sends the locked policy and deterministic check report to `POST https://api.beatapi.io/v1/systemone`, validates the two typed `noul` probabilities, and votes only when its own policy threshold is met. The [provider docs](https://docs.beatapi.io/decisions) say the free model works at zero balance with one successful request per minute before a top-up. Keep the API key in the server's `.dev.vars` or a deployment secret. A default auto-group key is required.

Without that key, the Cloudflare AI binding calls `typesafe/jev`. The first live call reached Cloudflare, but this account returned “Insufficient AI Gateway credits.” With a BeatAPI key in ignored `.dev.vars`, the second demo job received a real `jev-1.13-free` evaluation: requirements probability `0.94`, human-review probability `0.14`, recommendation `manual_review`. The locked policy requires human-review probability at most `0.10` for an automated PASS, so Jev correctly cast no vote. The two named human reviewers then passed job `#2`, the contract settled, and the worker withdrew 5 AUSD. Job `#1` also settled by two human votes. No Jev onchain vote is claimed for either job.

- Job `#2` Jev report hash: `0x62dd3b93fc419bca9ef35e2981d2bf853b23330f6dc15061e4304f3344b9efca`
- Job `#2` [deciding vote and settlement](https://testnet.monadvision.com/tx/0x43057fce2c834f6c5b25ac7e6de749e2287f6e5f4642e565735f2920fc6917bb)
- Job `#2` [worker withdrawal](https://testnet.monadvision.com/tx/0xd39b214af210b4e6ccdfaff77a26b27da933731e09068a971ed59b589bfad09d)

```sh
# With ACCRUE_BEATAPI_API_KEY in ignored .dev.vars and the app running,
# create and verify a fresh testnet agreement:
node scripts/demo-digital-work.mjs
```

## Run locally

Use Node 22.13 or newer. The local Vite configuration binds D1, R2, and Cloudflare AI. Set `NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS` in ignored `.env.local` and the dedicated `ACCRUE_JEV_VERIFIER_KEY` in ignored `.dev.vars`. The deploy script provisions both for Monad testnet. Apply `drizzle/0008_digital_work.sql` and `drizzle/0009_digital_manual_votes.sql` to the local D1 database before using the new API routes.

```sh
forge test --match-contract AccrueDigitalWorkTest
npm run build
npm run dev
```

The contract is a testnet prototype and has not been audited. Each job holds one deliverable and a fixed three-verifier set. The contract retains only hashes; readable policies, manifests, model reports, and signed review notes live in D1. The on-chain hashes bind those records to each agreement and evidence version.
