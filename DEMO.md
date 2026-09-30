# Demo: hire, prove, pay in three minutes

Everything below runs on Monad testnet with test AUSD. Nothing is simulated:
each step is a transaction you can open on the explorer, and the app shows
how long each one took to confirm (typically under a second).

## The three-minute path for a judge

One person can play every side. A passkey derives a client, a worker and a
reviewer account, and a guided walkthrough switches between them.

| # | Where | What you do | What to notice |
| --- | --- | --- | --- |
| 1 | `/` | Read the hero and scroll to Scenarios | The story: hire for digital work, pay when it's proven done |
| 2 | `/app` | Create an account (one passkey prompt) | No seed phrase, no extension, no gas to buy |
| 3 | Home | "Start the walkthrough", then "Claim test funds" | 10,000 test AUSD in a few seconds; the network fee is sponsored |
| 4 | Walkthrough | "Open the job form", then "Create job" | A two-stage job, already filled in with your worker and reviewer accounts |
| 5 | Walkthrough | Accept as worker, then as reviewer; fund as client | Funding is blocked until everyone accepted the exact terms |
| 6 | Walkthrough | Submit the first stage as worker | The note lands in the job's messages; its hash is on chain |
| 7 | Walkthrough | Approve as reviewer (or "Send back with notes") | Approval pays worker and reviewer in one transaction |
| 8 | Walkthrough | Withdraw as worker | The second stage's money is still locked, safe for the client |

Watch the bottom-right corner after each step: "Confirmed on Monad in 311 ms".

## Then look around

- **Hiring links and the job board.** Create a proof-checked job without a worker. You get a link, and with the box ticked it appears on [`/jobs`](http://localhost:5173/jobs). Whoever takes it shows up on your Home as "Create the job for @name", with the form filled in.
- **Proof Engine.** A proof-checked job can require a live web page containing agreed text, a GitHub pull request merged into your repository, or an API returning agreed data. It runs as soon as the worker submits. If its AI model is unavailable, the checks still stand and the reviewers decide, and the report says why.
- **Verified work.** `/u/<name>` is a public record of someone's paid jobs and review decisions, read from the chain, with job titles kept private.
- **Reviewer pool.** Anyone can offer to review for a fee from Home. The job forms suggest them.

## If something goes wrong in a live demo

- **A step seems stuck:** Refresh on Home re-reads the chain; state lives in the contracts, not the page.
- **Signed out mid-demo:** signing sessions last 15 minutes, and a banner offers "Stay signed in" two minutes before the end. Half-written job forms are kept.
- **Proof Engine says the AI review didn't run:** that's the provider, not the job. The reviewers can still decide.

---

## The recorded run: proof-checked job #6

[Watch the 70-second product video](./videos/accrue-verifiable-work/renders/video.mp4) or [follow job #6 step by step](./public/demo.html). The recording shows real use of Accrue on Monad testnet. It uses test AUSD, a live public API, a real AI provider response, and on-chain agreement, vote, settlement, and withdrawal transactions.

The narration frames the payer as a founder preparing to launch and the worker as a developer who wants payment secured. Those are relatable roles for the real testnet workflow, not claims about the actual account holders. The voice is Deepgram Aura-2 Zeus, generated through the installed Claude Speech plugin.

## What the video shows

| Time | Product action | Why it matters |
| --- | --- | --- |
| 0:00–0:14 | Create a digital-work agreement | The payer fixes the expected API result, worker, reward, and three verifier seats before funding. |
| 0:14–0:25 | Worker accepts; payer funds | Both sides share the exact policy, and 5.30 AUSD is reserved for the worker and reviewers. |
| 0:25–0:33 | Worker submits evidence | The public commit and deployment URL are bound to a versioned evidence hash. |
| 0:33–0:47 | Run Proof Engine | The commit, HTTP response, and JSON value pass. AI reports 94% requirements confidence and 15% human-review need. The locked 10% review limit makes the automated reviewer abstain. |
| 0:47–0:59 | Two verifier seats vote pass | Two signed on-chain votes from distinct verifier addresses reach the pre-set 2-of-3 quorum and make the reward payable. |
| 0:59–1:10 | Worker withdraws | The worker takes the 5 AUSD reward. The contract reports status `Paid` and a zero remaining claimable balance for the worker. |

The purple cursor, form entry, role changes, scrolls, and clicks are captured from the actual product session for job #6. The right-hand chapter panel follows the story from need through uncertainty to payout. The [editable video project](./videos/accrue-verifiable-work/) includes the screen clips and voiceover source.

## Evidence to open during a live presentation

- [The digital-work contract](https://testnet.monadvision.com/address/0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07)
- [Job #6 deciding vote and settlement](https://testnet.monadvision.com/tx/0x3575e2f43cadefc4c24d997b7f87df8767157da587871bfac518c868f8f903cc)
- [The deployed `/health` endpoint](https://accrue-verifiable-work-demo.pauleke65.workers.dev/health)
- [Product scope and technical boundary](./docs/DIGITAL-WORK.md)

Proof Engine is the Accrue verification flow, not an owned AI model. It combines public checks, the configured model, and the policy threshold. The model and provider remain visible in the technical record. The public checks confirm a commit exists and the endpoint returns the locked response; they do not establish that the deployment was built from that commit. The independent reviewers assess the remaining gap. This is an unaudited testnet prototype.
