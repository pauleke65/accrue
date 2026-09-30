# Accrue Pilot Operating Playbook & Incident Guide

This document contains standard operating procedures, support workflows, and safety controls for the **Accrue Construction & Service Pilot** on Monad.

---

## 1. Operating Model & Non-Custodial Boundaries

> [!IMPORTANT]
> Accrue is **non-custodial**. Funds deposited into agreements live strictly in the deployed smart contract (`AccrueEscrow.sol`). Accrue operators have **no administrative backdoor, private key, or balance-redirection authority**.

### Core Rules
1. **Deposits**: Funds are locked upon Payer funding.
2. **Releases**: Money is released only upon explicit milestone verification/approval by the assigned Verifier (or Payer if no verifier is designated).
3. **Refunds**: Returned strictly to the original Payer upon mutual cancellation consent or agreement expiry.
4. **Withdrawals**: Claimable strictly by the designated Worker or Verifier for earned milestones.

---

## 2. Standard Support Scenarios

### Scenario A: Lost Passkey / Device Loss
* **User Impact**: User lost the device holding their passkey credential.
* **Resolution**:
  * Because accounts are passkey-derived via WebAuthn PRF, if a user backed up their authenticator (e.g. iCloud Keychain, 1Password), signing in on a new device restores the exact same account.
  * If the passkey was unbacked and permanently lost, the account cannot sign. The remaining participants should execute a **Mutual Cancellation Vote** to refund reserved funds to the Payer or re-issue an agreement draft to a new address.

### Scenario B: Wrong Counterparty Tag Named
* **User Impact**: Payer created an agreement naming `@wrongtag`.
* **Resolution**:
  * Before funding, the Payer can simply ignore or cancel the unfunded draft and create a new agreement with the correct `@tag` or share a direct invitation link (`?invite=token`).

### Scenario C: Failed On-Chain Transaction / RPC Timeout
* **User Impact**: User signed transaction but UI displays a timeout or network error.
* **Resolution**:
  * Check the transaction hash on Monad Explorer.
  * The app's `hydrate()` function re-reads contract state on every load—refreshing the page syncs the UI directly from the blockchain authority.

---

## 3. Pilot Risk & Safety Limits

| Parameter | Pilot Setting |
|---|---|
| Max Agreement Milestone Count | 12 milestones |
| Recommended Agreement Duration | 7 to 60 days |
| Gas Sponsorship Top-up Threshold | 0.02 MON |
| Max Uploaded Evidence File Size | 10 MB per file |
| Supported Evidence Types | JPG, PNG, PDF, Text |

---

## 4. Off-Ramp Operational Guidance (Nigeria Pilot)

* **On-Chain Settlement**: State transitions to `Complete` and funds move to `workerWithdrawn` upon withdrawal.
* **Off-Ramp Distinction**: `AUSD Withdrawn (On-Chain)` indicates funds have left escrow to the recipient's wallet. Bank payout status (NGN) tracks off-ramp partner processing.
