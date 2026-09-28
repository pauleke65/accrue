---
format: 1920x1080
duration: 36s
message: "Accrue pays for a verified API outcome through a two-of-three verifier quorum."
arc: Demo Loop
audience: Monad hackathon judges and developers
mode: autonomous
music: none
---

## Video direction

Use the actual captured Accrue page as the source plate throughout. The site is the product proof; the overlay text is a short reading guide. Ink canvas `#17131F`, mint proof `#78E6B5`, violet accents and pale text from `frame.md`. One fixed screenshot fills most of each frame. Reveal overlay labels and proof chips in a measured sequence with smooth, long-tail motion, then hold for reading. Keep the final 17% clear of primary copy. Do not invent a Jev onchain vote, animated cursor action, simulated model output, or additional financial figures. The first frame establishes the outcome, the second walks the agreement, and the last shows the actual quorum and settlement plus the separate live Jev review result for job #2. Silent, with no captions or sound.

## Frame 1 — The outcome

- type: hook
- status: animated
- src: compositions/frames/01-outcome.html
- duration: 10s
- transition_in: cut
- scene: Real Accrue page opens on a verified 5 AUSD payout
- poster: 6s
- blueprint: compose
- focal: assets/scroll-000.png
- roles: scroll-000.png = full-page product screenshot
- asset_candidates: assets/scroll-000.png — the captured top of the real demo page

Scene 1 (0.0–2.0s): Captured top screenshot enters full bleed, slightly enlarged, with the product's real “Pay for the outcome” heading high-left. The live 5.00 AUSD payout card is legible at upper right.
Scene 2 (2.0–5.5s): A mint proof tag “5.00 AUSD paid” reveals beside the real payout card. The screenshot eases into a stable framing without obscuring the site.
Scene 3 (5.5–10.0s): A compact bottom-left line “One API task. One verifiable result.” appears; hold the screenshot and payout result still for reading.

## Frame 2 — The agreement

- type: feature_showcase
- status: animated
- src: compositions/frames/02-agreement.html
- duration: 13s
- transition_in: crossfade
- scene: Locked policy, pinned evidence, and endpoint checks on the real page
- poster: 8s
- blueprint: compose
- focal: assets/scroll-000.png
- roles: scroll-000.png = real agreement cards
- asset_candidates: assets/scroll-000.png — the captured policy and evidence cards at the top of the real demo page

Scene 1 (0.0–3.0s): Reframe the screenshot so the real three agreement cards become the center of the shot; introduce “Lock the terms” in a large restrained side label.
Scene 2 (3.0–7.0s): A mint rule line travels to the middle card and the next label “Pin the evidence” reveals. The captured GitHub commit and deployment links stay visible.
Scene 3 (7.0–10.5s): Move the rule line to the right card; reveal “Check GET /health → 200” near the existing expected result.
Scene 4 (10.5–13.0s): Hold the full three-card sequence. A small “2 of 3 approvals required” proof chip appears below the cards.

## Frame 3 — Quorum to payout

- type: benefit_highlight
- status: animated
- src: compositions/frames/03-settlement.html
- duration: 13s
- transition_in: crossfade
- scene: Two independent pass votes trigger settlement; live free Jev routes another job to human review
- poster: 8s
- blueprint: compose
- focal: assets/scroll-100.png
- roles: scroll-100.png = real votes, payout, and live Jev result note
- asset_candidates: assets/scroll-100.png — the captured lower page with two PASS votes, job #1 payout, and job #2 free Jev review result

Scene 1 (0.0–3.5s): Captured lower screenshot enters centered on the real vote table. A “2 / 3 PASS” mint chip reveals, while the Jev row remains visibly pending.
Scene 2 (3.5–7.5s): Reveal “Automatic settlement” beside the real settlement card; the captured card displays 5.00 AUSD paid to the worker.
Scene 3 (7.5–10.5s): Show the real worker withdrawal and two reviewer fees in the captured card, with a concise “Confirmed on Monad testnet” label.
Scene 4 (10.5–13.0s): Hold the truthful final state. Add the small, readable line “Free Jev checked job #2 · manual review at 14%.”
