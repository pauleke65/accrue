# Implementation Plan — Accrue Pilot: General Escrow & Real Collaboration

This document outlines the step-by-step technical execution plan for implementing the **Accrue Pilot Blueprint**. It focuses on transitioning Accrue from a single-device demo model with role-switching dropdowns to a multi-participant workspace powered by passkey identities, shareable invitations, participant inboxes, and optional pre-selected mediators on Monad.

---

## Goal Description

Refactor Accrue to support:
1. **Passkey-First Participant Identity**: A single passkey identity per user account representing an addressable participant across any agreement (as Payer, Worker, Verifier, or Mediator).
2. **Authenticated Shareable Invitations**: Invite counterparties via secure links; invitees verify terms and confirm their assigned role before accepting.
3. **Participant Action Inbox & Robust Lifecycle Visibility**: Ensure all agreement states (`pending_acceptance`, `ready_to_fund`, `funded`, `awaiting_review`, `completed`, `expired`, `cancelled`) are visible to all authorized participants without jobs vanishing after state changes.
4. **Smart Contract Primitives for Mediator / Dispute Authority**: Extend `AccrueEscrow.sol` to support optional pre-selected mediators and versioned agreement terms.

---

## User Review Required

> [!IMPORTANT]
> **One Identity vs Demo Roles**: By default, each passkey maps to one primary account address. The "Role Switcher" is relegated to a dev/demo toggle (`accrue.demoRoles=1`) so one developer on localhost can simulate 3 accounts, while real users experience true multi-device collaboration.

> [!IMPORTANT]
> **Preselected Mediator Model**: A mediator can only act if designated at agreement creation. The smart contract holds funds securely; Accrue servers cannot override escrow balances.

---

## Open Questions

> [!NOTE]
> 1. **Invitation Link Expiry**: Should shareable agreement invitation links expire after a default duration (e.g. 7 days) if unaccepted? *(Proposed default: 7 days, revokable by Payer).*
> 2. **Mediator Fee Structure**: Is mediator compensation handled as a fixed fee/percentage within the contract, or handled out-of-band for the pilot? *(Proposed default: optional mediator fee field in milestone definition).*

---

## Proposed Changes

### Component 1: Smart Contracts (`contracts/src/AccrueEscrow.sol`)

#### [MODIFY] `contracts/src/AccrueEscrow.sol`
- Add optional `mediator` address field to `Agreement` struct.
- Introduce `resolveDispute(uint256 id, uint256 milestoneIndex, bool approveWorker)` function callable strictly by the designated `mediator`.
- Add event `MediatorAssigned(uint256 indexed id, address indexed mediator)`.
- Ensure invariant `deposited = reserved + earned + withdrawn + refunded` holds across all edge cases.

#### [NEW] `contracts/test/AccrueEscrowMediator.t.sol`
- Property and fuzz tests for mediator resolution, multi-participant authority, and expiry refunds.

---

### Component 2: Database & Access Control (`db/schema.ts`, `lib/live-agreements-access.ts`, `lib/parties.ts`)

#### [MODIFY] `db/schema.ts`
- Add `mediatorAddress` and `mediatorTag` columns to `liveAgreements`.
- Add `agreement_invitations` table:
  ```typescript
  export const agreementInvitations = sqliteTable("agreement_invitations", {
    token: text("token").primaryKey(),
    agreementId: text("agreement_id").notNull(),
    role: text("role").notNull(), // 'worker' | 'verifier' | 'mediator'
    targetTag: text("target_tag"),
    expiresAt: text("expires_at").notNull(),
    claimedBy: text("claimed_by"),
    status: text("status").notNull(), // 'pending' | 'accepted' | 'revoked'
  });
  ```

#### [MODIFY] `lib/live-agreements-access.ts`
- Expand `accessibleLiveAgreements` to query agreements where a participant's verified address matches `payer_address`, `worker_address`, `verifier_address`, OR `mediator_address`.

#### [NEW] `app/api/invitations/route.ts`
- `POST /api/invitations`: Create shareable invite token for a specific agreement & role.
- `GET /api/invitations?token=...`: Resolve invitation details and verify agreement parameters.
- `POST /api/invitations/accept`: Claim role using passkey signature.

---

### Component 3: Identity & Wallet Context (`app/wallet-context.tsx`, `lib/mera-account.ts`)

#### [MODIFY] `app/wallet-context.tsx`
- Default `demoRoles` to `false`.
- Expose single primary address for user actions.
- Keep `proveParticipation()` so multi-address demo mode can still be toggled for single-device testing.

---

### Component 4: Workspace & Participant Inbox UI (`app/ui/live-agreements.tsx`, `app/workspace.tsx`)

#### [MODIFY] `app/ui/live-agreements.tsx`
- **Action Inbox Component**: Add an "Action Required" section at the top of the Funded Jobs dashboard highlighting tasks assigned to the active user:
  - *Payer*: "Fund agreement #12", "Review amendment"
  - *Worker*: "Accept terms for #14", "Submit evidence for Milestone 2"
  - *Verifier*: "Review submission for Milestone 1"
  - *Mediator*: "Review disputed milestone"
- **Permanent State Visibility**: Ensure agreements remain visible in the dashboard grid across all states (`pending_acceptance`, `ready_to_fund`, `funded`, `in_progress`, `completed`).
- **Invite Counterparty Modal**: Allow generating a shareable link (e.g. `https://accrue.app/?invite=XYZ`) with one-click copy.

#### [NEW] `app/ui/invitation-accept-modal.tsx`
- Renders when a user opens an invite link (`?invite=token`).
- Shows full agreement scope, payment milestones, and assigned role before requesting passkey acceptance.

---

## Verification Plan

### Automated Tests
1. **Contract Unit & Fuzz Tests**:
   ```bash
   cd contracts && forge test
   ```
2. **Participant Visibility Smoke Test**:
   ```bash
   node tests/participant-visibility-smoke.mjs
   ```
3. **Build & Type Check**:
   ```bash
   npm run build
   ```

### Manual Verification
1. **Multi-Device / Multi-Session Test**:
   - Open Device A (or Browser A): Sign in as Payer, create a job specifying `@worker_tag` & `@verifier_tag`. Generate invite link.
   - Open Device B (or Browser B): Sign in as Worker, open invite link, inspect terms, and accept.
   - Verify Device A immediately sees the status update to "Ready to Fund".
   - Payer funds the agreement. Verify both Device A and Device B see the agreement in "Funded / In Progress" state (no vanishing).
2. **Evidence Submission & Approval**:
   - Worker submits evidence from Device B.
   - Verifier approves from Device C (or Browser C).
   - Worker withdraws funds. Verify earnings update live on both devices.
