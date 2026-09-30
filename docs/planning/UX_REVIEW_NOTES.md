# Accrue UX & Frontend Review Notes

This document tracks identified usability gaps and missing frontend features, specifically focusing on the live blockchain integration (`sandbox-stabilization` branch) for future implementation.

### 1. Insufficient Funds Error Handling (Smart Contract)
* **Issue:** When a user attempts to **Fund** an agreement without holding enough AUSD, the transaction fails with an opaque or missing contract error.
* **Proposed Fix:** 
  * Add a pre-flight balance check on the frontend before allowing the user to click "Fund".
  * If `balance < depositAmount`, disable the button and show a clear warning: *"Insufficient AUSD balance. You need X AUSD to fund this."*

### 2. Getting Testnet AUSD is Hidden
* **Issue:** Users don't know how to get AUSD when they are stuck on the "Funded Jobs" dashboard. The "Get test AUSD" button is currently hidden away on the **Send** tab.
* **Proposed Fix:** 
  * Add a prominent "Claim Test AUSD" button or link directly on the "Funded Jobs" dashboard (perhaps inside a small wallet balance widget) so users can fund their wallets without leaving the primary workflow.

### 3. Tag Registration is Not Discoverable
* **Issue:** The builder requires a valid `@worker` tag, but if the tag doesn't exist, it throws a "tag not found" error. There is no inline way to create or invite a worker directly from the builder.
* **Proposed Fix:**
  * Add an inline tooltip or link next to the "Worker Tag" input explaining how tags work.
  * *Stretch Goal:* Allow users to invite workers via email/link directly from the builder if the tag doesn't exist yet, seamlessly integrating the onboarding flow.

### 4. General Sandbox vs. Live Clarity
* **Issue:** Moving from the database-driven Sandbox to the strictly On-Chain Live Jobs can be jarring. Users might not realize their Sandbox actions don't translate to Live tags/balances.
* **Proposed Fix:** Include a small banner or helper text explaining the strict separation of the two environments.

### 5. Fund Button Allowed Before Acceptances
* **Issue:** The UI allows the Payer to click the "Fund" button before the Worker and Verifier have accepted the agreement. This causes the smart contract to instantly reject (revert) the transaction with an opaque "acceptances required" error, confusing the user.
* **Proposed Fix:** 
  * Disable the "Fund" button dynamically by checking the acceptances bitmask (`hasAccepted`).
  * Display helper text above or below the disabled button stating: *"Waiting for the Worker and Verifier to accept the terms before funding can proceed."*

### 6. Agreement Disappears Between Acceptance and Funding
* **Issue:** After an agreement is accepted by the Worker/Verifier, it disappears from the active dashboard view and does not show up anywhere until it is funded. However, the Payer needs to be able to see the agreement in order to fund it, creating a broken user loop.
* **Proposed Fix:** 
  * Ensure agreements in the "Accepted but Unfunded" state remain visible on the Jobs dashboard for all participants.
  * Clearly tag these agreements with a "Ready to Fund" status badge for the Payer.

### 7. Agreement Disappears After Funding
* **Issue:** Once an agreement is successfully funded by the Payer, it completely disappears from the dashboard instead of transitioning to an "In Progress" or "Active" state. This prevents the Worker from submitting evidence and the Verifier from approving milestones.
* **Proposed Fix:** 
  * Debug the `hydrate` and rendering logic in the `LiveAgreements` component to ensure funded agreements (where `a.chain.funded` is true) are correctly parsed and displayed. 
  * Add a dedicated "Active / In Progress" section on the dashboard for agreements that have been successfully funded.
