# Competition rules and network facts

Checked 13 September 2026, then updated the same day once the application platform was signed in to. Every line was read from the source named beside it. Values that came from the platform are authoritative over the public marketing page, which differs on the closing date.

## 1. Dates and format

Read from the signed-in platform dashboard, which supersedes the public page.

| Item | Value | Source |
|---|---|---|
| Registration | Open through **6 Oct 2026** | Platform dashboard |
| Build window | 1 Sep – 14 Oct 2026 | Platform dashboard |
| Submissions open | **22 Sep 2026, 04:59 GMT+1** | Platform dashboard |
| **Submissions close** | **14 Oct 2026, 04:59 GMT+1** | Platform dashboard and every bounty page |
| Judging | 14 Oct – 3 Nov 2026 | Platform dashboard |
| Winners | From 4 Nov 2026 | Platform dashboard |

The public marketing page says the hackathon runs "1 Sep to 13 Oct". **The platform says 14 Oct at 04:59 GMT+1**, and each bounty detail page repeats that timestamp. Plan the freeze against 14 Oct 04:59 GMT+1, and note the deadline is just before 5am — an overnight cutoff, not an end-of-day one.

Registration closing 6 Oct is a separate and earlier deadline. Submissions cannot be made before 22 Sep.

## 2. Eligibility and submission

| Item | Value | Source |
|---|---|---|
| Who may enter | Anyone building on Monad; teams or solo; no prior onchain experience needed | monad.xyz FAQ |
| Country restrictions | "Open globally. Any eligibility restrictions are listed in the official rules on the application platform." | monad.xyz FAQ |
| Existing projects | Allowed, but the submitted work must have been built during the six weeks | monad.xyz FAQ |
| Open source | Encouraged, not required; judges must be able to verify what was built | monad.xyz FAQ |
| What to submit | Working product with a public project profile: a demo, a short write-up, and a link to the code | monad.xyz FAQ |
| Track choice | One track, chosen at application | monad.xyz FAQ |
| **Full official rules, video length, repo visibility, stacking rules** | **GATED** | Application platform |

Accrue's build began 9–10 September 2026, inside the window. The handoff and commit history evidence that.

## 3. Track 2 — Consumer Products & Payments

Verbatim from the track panel:

> Onchain rails can make financial products feel instant, programmable, and invisible to the end user.
> **Best fit for** Product teams who care more about a user's first five minutes than the architecture underneath.
> - A payments app that never mentions a blockchain to the person using it
> - Subscriptions that charge by the second instead of by the month
> - Shared wallets and group spending that settle up without an intermediary

Two of those three examples are already in Accrue's plan: the first is the PRD's stated posture on blockchain jargon, and the second is the P1 time-accrual template. That is worth knowing when deciding whether P1 earns its place.

Prize: **$30,000 per track, split evenly between 3 teams** — so $10,000 per winning team. Grand champion **$25,000** across all four tracks.

## 4. Sponsor bounties

Read from the signed-in platform. Every bounty carries the same deadline, 14 Oct 2026 04:59 GMT+1. One primary track is chosen per project; bounties are added on top, and those marked "all tracks" pair with any.

### The one that matches Accrue

**Best Cross-Border Payments App on Monad (Agora Payments Bounty)** — Agora, $10,000 USD, single prize, Consumer Products & Payments.

> Build a mobile app letting users send AUSD across borders using Mera passkey onboarding and instant settlement.

What it asks for, verbatim from the detail page:

- A **mobile application** that lets a user send AUSD to another person or across borders
- **Mera passkey authentication** for onboarding
- **Instant settlement** for the transfer itself
- Built against **Agora's public API documentation and staging environment**; internal codebase access is not provided
- Judged on implementation quality, real-world usability, and business viability of the payments flow
- Deliverable: a working demo showing **passkey onboarding, an AUSD balance, and a completed send/receive transaction settled instantly**

This is the closest fit to Accrue's pitch anywhere in the hackathon, and it is the largest single sponsor prize available to Track 2.

### Others relevant to this project

| Bounty | Sponsor | Amount | Track | Requirement worth noting |
|---|---|---|---|---|
| Best Mera-Powered UX on Monad | Monad Foundation | $2,500 | All | Mera must be the *entire* account layer: no seed phrase, extension, or custody backend. Must pass a "stateless test" — judges clear local storage or open the app on a fresh device mid-demo and identity must reconstruct from the passkey |
| Mera: One Passkey, Many Keys | Monad Foundation | $2,500 | All | Most creative non-wallet use of Mera's PRF-derived key material |
| Privy! | Privy | $5,000 | All | Must go beyond authentication; login-only will not qualify |
| Best Use of Dynamic | Dynamic | $5,000 | All | SDK for auth, embedded/agent wallets, or signing in a deployed app |
| Best Use of Envio | Envio | $1,000 | All | HyperIndex, HyperSync or HyperRPC powering a core feature |
| Best workflow with CRE | Chainlink | $3,000 | All | A CRE workflow used as an orchestration layer |
| Best Projects using Alchemy | Alchemy | $1,000 credits | All | At least one Alchemy service, meaningfully integrated |
| Best Builds Powered by KIMI | Kimi | $3,000 credits | All | Open scope |
| Best Community Team Project | Monad Foundation | $5,000 | All | Team from a Metropolis community supporter |

## 5. Decisions taken

**Account layer: Mera.** The $10,000 Agora bounty names Mera passkey onboarding as a requirement, so Privy cannot satisfy it. Privy's own bounty is $5,000 and is available on any track, but choosing Privy as the account layer forfeits the larger prize that matches this product. Mera additionally opens the $2,500 Mera UX bounty, whose demands — one passkey ceremony, prompt-free signing sessions, and reconstruction from the passkey alone — are compatible with what Accrue needs anyway.

**Mobile: extend the responsive PWA rather than going native.** Accrue is a responsive web app; the PRD already treats native Expo as a later option, not a demo dependency. **Open risk:** the bounty says "mobile app", and whether a PWA satisfies that has not been confirmed. Ask the organizers before relying on it.

**Product: add a direct AUSD send alongside milestone escrow.** The bounty's deliverable is a completed send/receive settled instantly, which milestone escrow does not by itself demonstrate. The notepad already proposed instant cross-border payments without milestones; that flow becomes a first-class part of the product rather than a later idea. The escrow rules must not change to accommodate it — a direct send is a distinct flow.

**Network: Monad testnet (10143).** AUSD exists there with a faucet, so the Agora story can be told end to end without moving real money through an unaudited contract. The Mera UX bounty explicitly accepts "testnet or mainnet".

## 6. Network and token facts

Verified against the official docs, then confirmed by direct `eth_call` against public RPC on 13 September 2026.

### Monad testnet — the target

| Item | Value |
|---|---|
| Chain ID | 10143 (confirmed via `eth_chainId`) |
| RPC | `https://testnet-rpc.monad.xyz`, `https://rpc-testnet.monadinfra.com`, `https://rpc.ankr.com/monad_testnet` |
| Gas faucet | https://faucet.monad.xyz |
| Explorers | https://testnet.monadvision.com, https://testnet.monadscan.com |
| Reset | Testnet was reset from genesis on 2025-12-16 |
| ERC-4337 EntryPoint | v0.6 – v0.9 deployed |
| Wrapped MON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |

Tokens on testnet, decimals read on-chain:

| Token | Address | Decimals |
|---|---|---|
| **AUSD (Agora)** | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` | **6** (confirmed; name and symbol both "AUSD") |
| AUSD testnet faucet contract | `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` | deployed, 1,200 bytes of code |
| USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | 6 (confirmed) |

The Agora deployments page lists the same AUSD testnet address across Arbitrum Sepolia, Avalanche Fuji, Monad Testnet and others, so it is Agora's standard testnet deployment rather than a Monad-specific one.

### Monad mainnet — the production target, not the demo

| Item | Value |
|---|---|
| Chain ID | 143 (confirmed) |
| RPC | `https://rpc.monad.xyz` (QuickNode, 25 rps) and four others |
| Explorers | https://monadvision.com, https://monadscan.com |
| **AUSD** | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, 6 decimals (confirmed) |
| USDC | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`, 6 decimals (confirmed) |
| ERC-4337 EntryPoint | v0.6 – v0.9 |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

### AUSD token capabilities

From Agora's contract overview, AUSD is ERC-20 plus:

- **EIP-712** typed structured signing
- **ERC-1271** contract-wallet signature validation — needed because a Mera passkey account is a smart account, and the escrow must accept its signatures
- **ERC-2612** permit, approvals by signature
- **ERC-3009** gasless transfers — directly useful for the "instant settlement" requirement and for sponsored gas

It also supports minting, burning, and **asset freezing by privileged accounts**. That last point belongs in the product's risk disclosure: the PRD already states the escrow's guarantees do not imply immunity from token issuer controls, and AUSD is a concrete example.

The sandbox counts integer cents; the contract counts raw 6-decimal base units. These are not interchangeable and must not be mixed.

## 7. Still unverified

1. **Whether a PWA satisfies the Agora bounty's "mobile app".** The largest eligibility risk on the largest prize. Ask the organizers in Discord.
2. **Official rules document** — eligibility restrictions by country, video length, repository visibility, and award-stacking rules. The dashboard links registration and submission steps but the rules text was not located in this pass.
3. **Agora staging API** — the bounty says to build against Agora's public API docs and staging environment. What that API provides beyond the token contract is not yet established.
4. **Mera SDK specifics** — session scoping, PRF key derivation, and whether it supports the browser passkey flow this PWA needs.
5. **Deployment authorisation** — a funded testnet deployer key. Testnet MON comes from the faucet, so this costs nothing, but broadcasting still needs an explicit instruction.
