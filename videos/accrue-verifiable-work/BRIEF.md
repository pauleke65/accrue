---
workflow: product-launch-video
flow: automation
storyboard: no
message: "A real testnet walkthrough of an API agreement from creation to worker withdrawal."
destination: product-demo
aspect: 1440x900
language: en
audience: "Monad hackathon judges and developer users"
length: 76.7s
angle: "Use Accrue live and explain each economic and verification step"
---

## Intent

A narrated recording of the actual Accrue product in use. The browser flow creates testnet job #4, accepts and funds it, submits evidence, runs BeatAPI Jev, collects two human votes, and withdraws the worker reward. The narration speaks in first person and explains the state transitions.

## Assets

Six real browser recordings and six matching voiceover clips live in `assets/walkthrough/`. The recordings were made against the local UI connected to Monad testnet. `recordings/recording.json` contains the job and addresses.

## Truth constraints

Jev returned 94% requirements and 14% human-review need. Because the agreement's review limit was 10%, Jev abstained. Two independent human reviewers passed the work. The five AUSD withdrawal was executed on testnet. The commit and deployment checks do not cryptographically prove that the deployed code came from that commit.
