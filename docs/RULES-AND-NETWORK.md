# Competition rules and network facts

Checked 13 September 2026. Every line below was read from the source named beside it on that date. Anything marked **GATED** could not be verified because it sits behind registration on the application platform; do not treat the surrounding public copy as a substitute for it.

## 1. Dates and format

| Item | Value | Source |
|---|---|---|
| Build window | 1 Sep – 13 Oct 2026 | [monad.xyz Metropolis](https://monad.xyz/developers/hackathons/metropolis) |
| Judging | 14 – 27 Oct 2026, per track | same, FAQ |
| Winners announced | 3 Nov 2026 | same, FAQ |
| Format | Online, global; city activations during the window | same, FAQ |
| **Deadline time of day and timezone** | **GATED** | Application platform |

The PRD requires the exact deadline timestamp and timezone from the portal. The public page gives a date only. That is the single most important gated value: a submission freeze has to be planned against it.

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

Read from the public sponsor-prize panel. The page states the full list is on the platform, so treat this as partial and the amounts as unconfirmed against any rubric.

Directly relevant to Accrue:

| Bounty | Amount | Relevance |
|---|---|---|
| **Best Cross-Border Payments App on Monad** | **$10,000** | Accrue's central pitch, almost verbatim |
| Best Use of Dynamic | $5,000 | Wallet option A |
| Privy! | $5,000 | Wallet option B |
| Best Use of Envio | $1,000 | Indexer, already in the PRD |
| Best workflow with CRE | $3,000 | Chainlink CRE, PRD P1 |
| Best Projects using Alchemy | $1,000 in credits | RPC/account infrastructure |
| Best Mera-Powered UX on Monad | $2,500 | Named in the notepad |
| Mera: One Passkey, Many Keys | $2,500 | Passkey onboarding |
| Best Builds Powered by KIMI | $3,000 in credits | Named in the notepad |
| Best Agent Wallet Plugin | $2,500 | Notepad's AI-agent idea |

Agora appears among the sponsor logos but no Agora-named bounty is visible publicly. **GATED:** whether an Agora bounty exists, and every rubric and stacking rule.

Note the wallet decision now has money attached on both sides ($5,000 either way), so it should be made on rubric and dashboard access, not on price.

## 5. Network and token facts

Verified against the official docs, then confirmed by direct `eth_call` against public RPC on 13 September 2026.

### Mainnet

| Item | Value |
|---|---|
| Chain ID | 143 (confirmed via `eth_chainId`) |
| Currency | MON |
| RPC | `https://rpc.monad.xyz` (QuickNode, 25 rps), plus Alchemy, Goldsky, Ankr, MF endpoints |
| Explorers | https://monadvision.com, https://monadscan.com |
| ERC-4337 EntryPoint | v0.6 / v0.7 / v0.8 / v0.9 all deployed — relevant to gas sponsorship |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

Tokens, decimals read on-chain:

| Token | Address | Decimals |
|---|---|---|
| **AUSD (Agora USD)** | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | **6** (confirmed) |
| USDC | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | 6 (confirmed) |
| USDT0 | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | not checked |

The PRD's preferred token exists on Monad mainnet and reports 6 decimals. The sandbox uses integer cents; the contract must use raw 6-decimal base units. These are not interchangeable.

### Testnet

| Item | Value |
|---|---|
| Chain ID | 10143 (confirmed via `eth_chainId`) |
| RPC | `https://testnet-rpc.monad.xyz`, `https://rpc-testnet.monadinfra.com`, `https://rpc.ankr.com/monad_testnet` |
| Faucet | https://faucet.monad.xyz |
| Explorers | https://testnet.monadvision.com, https://testnet.monadscan.com |
| Reset | Testnet was reset from genesis on 2025-12-16 |
| ERC-4337 EntryPoint | v0.6 – v0.9 deployed |

Testnet tokens are a short list: MON, **USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6 decimals, confirmed on-chain)**, WETH, WMON.

**There is no AUSD on testnet.** This is the decision that shapes the demo.

## 6. The open decision this creates

| | Mainnet (143) | Testnet (10143) |
|---|---|---|
| AUSD available | Yes | No — USDC test token only |
| Agora / cross-border story | Strongest | Weaker, must be told with a test token |
| Risk | Real funds against an unaudited, unreviewed contract | None |
| Faucet | No | Yes |

The contract has had no independent audit. Moving real value through it to strengthen a demo is a real risk with a real downside, and the PRD's own release gate forbids treating testnet success as production readiness. A middle path exists: deploy and demo on testnet, and describe the mainnet AUSD path honestly as the production target rather than staging it with real money.

**GATED and needed before this is settled:** whether the rules require or permit a particular network, and whether any sponsor bounty requires mainnet or a specific token.

## 7. What is still blocked

1. **Platform rules.** `hackathon.monad.xyz` requires sign-in with GitHub, Google or Discord before showing rules, full bounty list, or submission requirements. Registering an account or granting OAuth is the user's action, not the agent's. Needed from behind it: exact deadline and timezone, eligibility restrictions, video length, repository visibility requirement, award-stacking rules, each relevant bounty's rubric, and any network or token requirement.
2. **Wallet provider decision** — Privy or Dynamic, plus dashboard credentials.
3. **Deployment authorisation** — a funded deployer key and an explicit instruction to broadcast.
