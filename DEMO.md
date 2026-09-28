# Accrue Proof Engine walkthrough

[Watch the 70-second product video](./videos/accrue-verifiable-work/renders/video.mp4) or [follow job #6 step by step](./public/demo.html). The recording shows real use of Accrue on Monad testnet. It uses test AUSD, a live public API, a real AI provider response, and on-chain agreement, vote, settlement, and withdrawal transactions.

## What the video shows

| Time | Product action | Why it matters |
| --- | --- | --- |
| 0:00–0:14 | Create a digital-work agreement | The payer fixes the expected API result, worker, reward, and three verifier seats before funding. |
| 0:14–0:25 | Worker accepts; payer funds | Both sides share the exact policy, and 5.30 AUSD is reserved for the worker and reviewers. |
| 0:25–0:33 | Worker submits evidence | The public commit and deployment URL are bound to a versioned evidence hash. |
| 0:33–0:47 | Run Proof Engine | The commit, HTTP response, and JSON value pass. AI reports 94% requirements confidence and 15% human-review need. The locked 10% review limit makes the automated reviewer abstain. |
| 0:47–0:59 | Two named reviewers vote pass | Two distinct on-chain votes reach the pre-set 2-of-3 quorum and make the reward payable. |
| 0:59–1:10 | Worker withdraws | The worker takes the 5 AUSD reward. The contract reports status `Paid` and a zero remaining claimable balance for the worker. |

The purple cursor, form entry, role changes, scrolls, and clicks are captured from the actual product session for job #6. The right-hand chapter panel, camera movement, and narration make each action readable in the shortened cut. The [editable video project](./videos/accrue-verifiable-work/) includes the screen clips and voiceover source.

## Evidence to open during a live presentation

- [The digital-work contract](https://testnet.monadvision.com/address/0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07)
- [Job #6 deciding vote and settlement](https://testnet.monadvision.com/tx/0x3575e2f43cadefc4c24d997b7f87df8767157da587871bfac518c868f8f903cc)
- [The deployed `/health` endpoint](https://accrue-verifiable-work-demo.pauleke65.workers.dev/health)
- [Product scope and technical boundary](./docs/DIGITAL-WORK.md)

Proof Engine is the Accrue verification flow, not an owned AI model. It combines public checks, the configured model, and the policy threshold. The model and provider remain visible in the technical record. The public checks confirm a commit exists and the endpoint returns the locked response; they do not establish that the deployment was built from that commit. The independent reviewers assess the remaining gap. This is an unaudited testnet prototype.
