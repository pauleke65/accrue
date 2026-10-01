# Accrue: Monad Metropolis submission pack

Everything needed to fill in the submission form at
[hackathon.monad.xyz](https://hackathon.monad.xyz) and to record the demo
video. Facts here were checked against the live deployment on 1 October 2026.

| | |
|---|---|
| Track | **Track 2: Consumer Products & Payments** |
| Bounties that fit | Agora **Best Cross-Border Payments App on Monad** · Monad Foundation **Best Mera-Powered UX on Monad** · Envio **Best Use of Envio** |
| Submissions close | 13 Oct 2026, 11:59 pm ET (14 Oct, 04:59 GMT+1) |
| Live app | https://accrue.accrue-escrow.workers.dev |
| Code | https://github.com/pauleke65/accrue (public) |
| Team | Paul Imoke, Victor Shallangwa |
| Built | 11 Sep – 1 Oct 2026, inside the build window; see the commit history |

---

## 1. Form copy

### Project name

Accrue

### Tagline

Hire for digital work. Pay when it's proven done.

### One-line description

Escrow for remote work on Monad: sign up with a passkey, pay anyone by
@name in AUSD, or lock a job's pay in a contract that releases it when the
work is approved, settling in under a second.

### Short write-up

Remote hiring runs on trust nobody can check. The client pays upfront and
hopes, or holds back and good people walk away; a marketplace in the middle
holds both sides' money and settles disputes on its own schedule.

Accrue replaces the middle with a contract. A client locks the pay in escrow
on Monad before work starts, so the worker can see it is there. The terms,
including what counts as done, are fixed by hash and accepted by everyone
before a cent moves. Approval pays the worker and the reviewer in one
transaction, and the client cannot claw back what has been earned. Anything
never earned goes back to the client.

There are two ways to approve. A **milestone job** is released stage by stage
by the client or a reviewer both sides named. A **proof-checked job** is
judged by Proof Engine: checks that cannot be argued with (does the page say
what was agreed, is the pull request merged, does the API answer correctly),
an AI reading of the brief, and two named human reviewers. Two of three pass
votes pay. Proof Engine votes only when it is confident, and otherwise says
why and lets the humans decide.

It never asks anyone to understand a blockchain. Signing up is one passkey,
with no seed phrase, no extension and no gas to buy, because the first network
fee is sponsored. You pay `@bola`, not a 42-character address, and every
payment tells you how long it took: "Confirmed on Monad in 311 ms".

### What is real (for the "how far did you get" field)

- Live on **Monad testnet** with **Agora's AUSD**; two escrow contracts
  deployed and exercised end to end through the interface.
- **Mera passkeys** are the whole account layer. One ceremony derives the
  client, worker and reviewer keys; clearing the browser and signing in with
  the passkey alone brings back the same account and @name.
- **Envio HyperSync** reads payment history and escrow activity across the
  whole chain (the public RPC caps log reads at 100 blocks).
- **Agora's public API** supplies AUSD's live supply on Monad; bank cash-out
  through Agora Routes is built and needs Agora organisation access to switch on.
- Installable on a phone from the browser ("Add to Home Screen").
- 46 unit tests, 41 contract tests (including a 256-run conservation fuzz),
  HTTP smoke suites, and a recorded passkey-driven run on the live deployment,
  in [VERIFICATION.md](../../VERIFICATION.md).
- Test money on a test network. Not audited.

### Why Monad

Escrow only feels safe if it feels instant. On Monad, creating, funding,
approving and withdrawing each confirmed in 0.1 to 0.8 seconds in our 1 October
run (eight transactions, 501 ms on average), so a verified job feels paid
rather than pending. That speed is what lets the payment step disappear into
the product, and the app shows the time and network fee of every transaction.

### Business model (hypothesis, not validated)

Direct sends free. A small fee on funded jobs, paid by the client and shown
before funding, with verifier fees stated separately. Pricing is to be tested
against willingness to pay; nothing here claims traction.

### Links for the form

| What | Link |
|---|---|
| Live app | https://accrue.accrue-escrow.workers.dev |
| Repository | https://github.com/pauleke65/accrue |
| Demo video | *(upload, then paste the link here)* |
| 70-second Proof Engine walkthrough | https://accrue.accrue-escrow.workers.dev/proof-engine-walkthrough.mp4 |
| Interactive proof trail of job #6 | https://accrue.accrue-escrow.workers.dev/demo |
| Milestone escrow | https://testnet.monadvision.com/address/0xf8c44A529cd0470597C7865d2B2473abff65d0De |
| Proof-checked escrow | https://testnet.monadvision.com/address/0x2Fdfa4470fB43d9432f021fDB4043d59fF8C8f07 |
| Judge's three-minute path | https://github.com/pauleke65/accrue/blob/main/DEMO.md |
| Architecture | https://github.com/pauleke65/accrue/blob/main/IMPLEMENTATION.md |

### Bounty notes (one paragraph each, if the form asks)

**Agora, Best Cross-Border Payments App.** Accrue is a phone-installable app
for paying people across borders in AUSD. Onboarding is a Mera passkey, the
home screen shows the AUSD balance, and a send to an `@name` settles on Monad
in under a second, with the receiver seeing it land. Beyond one-off sends,
the same AUSD can be held in escrow until work is approved, which is the
payment a client abroad hiring a freelancer actually needs. AUSD supply on
Monad comes from Agora's public API; cash-out to a bank through Agora Routes
is built and needs organisation access.

**Mera, Best Mera-Powered UX.** Mera is the entire account layer: one passkey
ceremony, no seed phrase, no extension, no custody backend. Keys are derived
from the passkey's PRF output, so clearing storage or opening the app on a
fresh device restores the same account and @name from the passkey alone. A
15-minute signing session means the walkthrough's dozen transactions need no
further prompts. One passkey also derives separate client, worker and reviewer
keys, so one person can play every side of a real escrow job on one device.

**Envio, Best Use of Envio.** Payment history and escrow activity are read
with HyperSync over the whole chain in one request; the public RPC caps log
queries at 100 blocks, so without it an account's history would start when the
app first saw it. HyperRPC handles range reads the public RPC refuses.

---

## 2. Demo video

Target **3:00**. The Agora bounty's deliverable is explicit (passkey
onboarding, an AUSD balance, and a completed send/receive settled instantly),
and Mera judges run a "stateless test", so the video shows all four on screen.

### Before recording

1. Use a passkey provider with PRF: iCloud Keychain (Safari or Chrome on
   recent macOS/iOS), Google Password Manager in Chrome, or 1Password.
   Windows Hello often lacks PRF; the app says so if it does.
2. Two people, two phones, if possible: the sender and the receiver each
   install Accrue from the browser (Share → Add to Home Screen) and claim an
   @name. A send from one country to a teammate in another is the
   cross-border story told literally.
3. Do one dry run of the walkthrough first. Each brand-new role account waits
   about 30 seconds the first time it acts while its sponsored gas arrives;
   cut those waits in the edit, or warm the accounts in the dry run.
4. Signing sessions last 15 minutes. Start the session just before the take,
   and use "Stay signed in" if the banner appears.
5. Record at 1080p or more; phone clips vertical, desktop clips 16:9.

### Script

| Time | Screen | Action | Voiceover |
|---|---|---|---|
| 0:00–0:12 | Landing page | Slow scroll past the hero and "Job #6" card | "Remote work runs on trust nobody can check. Clients pay up front and hope, or hold back and good people walk away. Accrue replaces the middleman with a contract on Monad." |
| 0:12–0:35 | Phone, home-screen app | Open Accrue from the icon, tap **Create an account**, approve the passkey; Home shows Wallet / Locked / Ready to withdraw. Tap **Claim test funds** | "Signing up is one passkey: no seed phrase, no extension, no gas to buy. The first network fee is on us. That's a real AUSD balance from Agora, on Monad." |
| 0:35–1:00 | Phone A, then phone B | **Send** → To `@teammate` → `25` → **Send AUSD**. Hold on "Confirmed on Monad in … ms". Cut to phone B: balance up 25, payment in history | "Paying someone in another country is just their name. Twenty-five dollars, confirmed on Monad in under a second. On the other side it has already landed. The history comes from Envio, across the whole chain." |
| 1:00–1:20 | Desktop, Home | **Start the walkthrough** → **Open the job form** → show both stages and amounts → **Create job** | "Bigger jobs go through escrow. The client writes the job and exactly what counts as done for each stage." |
| 1:20–1:35 | Job page | Accept as worker, then reviewer (cut between them), then **Fund 2.20 AUSD** | "Worker and reviewer accept the exact terms; nobody can fund until all three have. Funding moves the money into the contract, not to us and not yet to the worker, but the worker can see it's there." |
| 1:35–1:55 | Job page | As worker, type a note and **Submit for review**. As reviewer, **Approve and pay 1.10** | "The worker submits. The reviewer approves, and one transaction pays the worker and the reviewer's fee. The client can't take it back." |
| 1:55–2:05 | Job page | As worker, **Withdraw 1.00**. Show stage 2 still locked | "The worker withdraws. The second stage's money is still locked, safe for the client." |
| 2:05–2:30 | Clip from the 70-second Proof Engine video (0:33–0:59) | Proof Engine report, two reviewer votes, settlement | "For work a machine can check (a live page, a merged pull request, a working API) Proof Engine runs the checks and asks an AI whether the evidence meets the brief. It votes only when it's sure. Here it wasn't, so two named reviewers decided. Two of three votes pay." |
| 2:30–2:45 | Phone or desktop | Clear site data (or open on a second device), reopen, **I have an account**, passkey: same @name and balance | "Nothing about your account lives on our servers. Clear the browser or pick up another device, and the passkey alone brings it back." |
| 2:45–3:00 | Landing "What is real" section, then end card | End card: URL and GitHub | "Accrue. Hire for digital work, pay when it's proven done. Live on Monad today with Mera passkeys, Agora's AUSD and Envio. accrue.accrue-escrow.workers.dev." |

About 400 words of voiceover: a calm pace with room for the on-screen
confirmations. The existing narration in
[`videos/accrue-verifiable-work`](../../videos/accrue-verifiable-work/) uses
Deepgram Aura-2 Zeus if a generated voice is wanted for consistency.

### On-screen captions (optional)

- 0:15 "One passkey · Mera"
- 0:40 "AUSD by Agora · settled on Monad"
- 0:55 "History: Envio HyperSync"
- 1:25 "Funds held by the contract, not by Accrue"
- 1:45 "One transaction pays worker + reviewer"
- 2:35 "Stateless: identity rebuilt from the passkey"
- End card "Test money on Monad testnet · not audited"

---

## 3. Assets

| Asset | File | Use |
|---|---|---|
| Logo / avatar | [`public/icon-512.png`](../../public/icon-512.png) (512×512), [`public/icon.svg`](../../public/icon.svg) | Project avatar on the platform |
| Cover image | [`screenshots/01-landing.png`](./screenshots/01-landing.png) | Project banner |
| Gallery | [`screenshots/`](./screenshots/), listed below | Screens from the live app, captured during the 1 October run |
| Existing video | [`videos/accrue-verifiable-work/renders/video.mp4`](../../videos/accrue-verifiable-work/renders/video.mp4) (70 s) | Proof Engine segment, or a second video link |
| Proof trail | https://accrue.accrue-escrow.workers.dev/demo | Linked from the write-up |

### Gallery captions

1. `01-landing.png`: Hire for digital work. Pay when it's proven done.
2. `02-send-confirmed.png`: A payment confirmed on Monad in 685 ms, with its network fee.
3. `03-job-form.png`: The client writes the job; worker and reviewer are named up front.
4. `04-fund-escrow.png`: Everyone has accepted the exact terms, so the client can fund.
5. `05-review-and-approve.png`: The reviewer approves, or sends it back with notes.
6. `06-walkthrough-finished.png`: Eight transactions, 501 ms on average; stage 2 still locked.
7. `07-phone-home.png`: Accrue at phone width: wallet, escrow, earnings.
8. `08-phone-send.png`: "Send money home": claim a name people can pay.

## 4. Evidence a judge can open

Recorded proof-checked job #6 (Proof Engine abstained, two reviewers paid):
[deciding vote and settlement](https://testnet.monadvision.com/tx/0x3575e2f43cadefc4c24d997b7f87df8767157da587871bfac518c868f8f903cc).

The 1 October passkey-driven run on the live deployment is listed, transaction
by transaction, in [VERIFICATION.md](../../VERIFICATION.md#live-end-to-end-run-on-the-deployed-app).
