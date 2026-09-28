# Proof Engine walkthrough narration

## intro

This is Accrue Proof Engine.

## create

I define the API outcome and lock the reward, deadline, worker, and verifier quorum. The agreement is created on Monad testnet.

## accept-fund

The worker accepts those exact terms. I switch back to the payer and fund five AUSD for the work, plus thirty cents for verification.

## submit

The worker pins a GitHub commit and live API URL. Accrue records the fingerprint of this evidence on-chain.

## proof-engine

Proof Engine checks the commit, HTTP, and JSON. It scores requirements at ninety-four percent, but human review need at fifteen. That exceeds the ten percent limit, so it abstains.

## quorum

I sign a pass review. A second independent reviewer signs the same conclusion. Two of three reaches quorum, and the contract makes the reward payable.

## withdraw

I switch to the worker and withdraw five AUSD. That is a real testnet payout, with every vote recorded on-chain.

## outro

Proof, then payment.
