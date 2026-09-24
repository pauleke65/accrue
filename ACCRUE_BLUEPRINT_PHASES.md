# Accrue Pilot Blueprint — Comprehensive Guide to All 6 Phases

This document provides a complete technical, architectural, and operational guide explaining all delivery phases (**Phase 0 through Phase 5**) of the **Accrue Pilot Blueprint**.

---

## 1. Architectural Overview & Invariants

Accrue is a general-purpose, non-custodial agreement workspace built on Monad and settled in AUSD. The initial pilot targets diaspora-funded Nigerian construction and renovation projects, using reusable escrow primitives rather than becoming single-purpose software.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         Passkey Identity (WebAuthn PRF)                 │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           Agreement Workspace                             │
│  ├── Terms & Scope                ├── Action Required Inbox              │
│  ├── Authenticated Invitations    ├── R2 Evidence & SHA-256 Verification │
│  └── Pre-Flight Funding Review    └── Expiry & Mutual Cancellation       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      AccrueEscrow.sol (Monad Testnet)                    │
│  ├── Payer Deposit (AUSD)          ├── Milestone Verification            │
│  ├── On-Chain Acceptances          └── Earned Withdrawals & Refunds      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Core Invariants
1. **Non-Custodial Escrow**: Deposited funds sit strictly in `AccrueEscrow.sol`. Accrue servers have zero unilateral authority over funds.
2. **Immutable Accounting**: `deposited = reserved + workerEarned + verifierEarned + refunded`. Earned funds can never be reclaimed.
3. **Passkey-First Identity**: Each user has one primary passkey identity derived via WebAuthn PRF. A developer demo toggle (`accrue.demoRoles=1`) is available for single-device walkthroughs.
4. **Permanent State Visibility**: Agreements remain visible to all verified participants across every state transition (`pending_acceptance`, `ready_to_fund`, `funded`, `in_progress`, `completed`).

---

## 2. Detailed Breakdown of the 6 Delivery Phases

### Phase 0 — Define the Pilot & Operating Model

**Goal:** Establish pilot boundaries, target user personas, plain-language agreement rules, and construction templates.

- **Target Persona**: Diaspora payers in London/US funding real Nigerian residential construction, renovation, or professional services.
- **Pilot Scope & Limits**:
  - Maximum 12 milestones per agreement.
  - Duration: 7 to 60 days.
  - Gas sponsorship ceiling: 0.02 MON.
  - File evidence limit: 10 MB per upload (JPG, PNG, PDF, Text).
- **Pilot Templates**:
  1. *Construction & Renovation*: Foundation, Blockwork to Lintel, Roofing, Plastering.
  2. *One-Off Contractor Work*: Mobilization, Execution & Inspection.
  3. *Professional Service Delivery*: Concept Schematics, Approved Blueprints.
  4. *Goods & Procurement*: Sourcing & Dispatch, On-Site Quality Inspection.

---

### Phase 1 — Real Collaboration & Passkey Identity

**Goal:** Move from single-device role switching to true multi-participant collaboration powered by passkeys, shareable invitations, and participant inboxes.

- **Passkey-First Identity Model (`app/wallet-context.tsx`)**:
  - Defaulting to a single passkey identity address per user account.
  - Exposing `proveParticipation()` so participant access can be cryptographically proven without exposing private keys.
- **Authenticated Shareable Invitations (`/api/invitations`, `app/ui/invitation-accept-modal.tsx`)**:
  - Payer generates a share link (`?invite=token`) for assigned counterparty roles (`worker` | `verifier`).
  - Counterparty opens the link, inspects full agreement scope and milestones, and accepts the role using their passkey.
- **Action Required Inbox (`app/ui/live-agreements.tsx`)**:
  - Dynamic banner on the Agreements page highlighting tasks assigned to the active user ("Accept terms", "Fund deposit", "Review submission").
- **Multi-Party Access (`lib/live-agreements-access.ts`)**:
  - `accessibleLiveAgreements()` queries agreements matching `payer_address`, `worker_address`, OR `verifier_address`.

---

### Phase 2 — Build the Agreement Workspace

**Goal:** Make the agreement useful throughout a project with template presets, pre-flight funding checks, and R2 evidence packages.

- **Template Picker (`app/ui/templates.ts`, `app/ui/live-agreements.tsx`)**:
  - Integrated template selection chips in the Builder pre-filling titles, scope, days, and milestone criteria.
- **Pre-Flight Funding Review Screen (`app/ui/funding-review-modal.tsx`)**:
  - Review modal rendered prior to executing `live.fund()` checking:
    - Required deposit vs Payer AUSD balance (`balance >= deposit`).
    - Network gas status vs `GAS_TOPUP_THRESHOLD`.
    - Allowance status and contract terms preview.
- **First-Class Evidence Packages (`app/api/evidence/route.ts`)**:
  - Upload R2 evidence files (photos, site reports, PDFs, notes) for `live_agreements`.
  - Hashing evidence content via SHA-256 matching the on-chain `evidenceHash`.

---

### Phase 3 — Amendments, Expiry, and Disputes

**Goal:** Handle real-world project changes (cancellation, expiry, term revisions) without requiring contract modifications.

- **Mutual Cancellation Workflow (`app/use-live-agreements.ts`, `app/ui/live-agreements.tsx`)**:
  - Participants call `consentCancellation(id)` on-chain via `useLiveAgreements`.
  - Displays cancellation progress badge (`a.cancellationVotes`).
- **Permissionless Expiry Refund (`app/use-live-agreements.ts`, `app/ui/live-agreements.tsx`)**:
  - Payer calls `refund(id)` when an agreement is cancelled or past its expiry date (`block.timestamp >= expiry`), safely returning reserved AUSD to the Payer.
- **Duplicate & Revise Amendment Drafts**:
  - "Duplicate as Draft" action pre-filling the builder with an existing agreement's title, scope, and milestone structure so parties can issue a revised agreement version for mutual acceptance.

---

### Phase 4 — Notifications, Trust, and Repeat Use

**Goal:** Enable participant inspection, saved counterparties, and exportable receipts.

- **Participant Profile Cards (`app/ui/profile-card.tsx`)**:
  - Clickable `@tag` inspector launching a profile modal displaying tag handle, verified passkey EVM address, and WebAuthn identity status.
- **Repeat Contracting**:
  - "Duplicate as Draft" action allowing Payers to re-use previous agreement structures for new milestone contracts.
- **Printable Receipts & Exportable Summaries (`app/ui/receipt.tsx`)**:
  - Printable agreement receipts featuring milestone payment breakdowns, SHA-256 evidence digests, and on-chain transaction hashes.

---

### Phase 5 — Financial Endpoints & Production Hardening

**Goal:** Track off-ramp status and provide operating playbooks for pilot deployment.

- **Off-Ramp Status Indicator (`app/ui/live-earnings.tsx`)**:
  - Clear UI distinction in Earnings between `AUSD Withdrawn (On-Chain)` (funds in Monad passkey wallet) and `Bank Payout (NGN Off-Ramp Ready)` (local bank settlement).
- **Pilot Operating Playbook (`PILOT_PLAYBOOK.md`)**:
  - Operating guide covering non-custodial boundaries, lost access handling, wrong invitees, network RPC timeouts, and risk limits.

---

## 3. Summary Matrix & Verification Status

| Phase | Core Objective | Key Component / File | Verification Status |
|---|---|---|---|
| **Phase 0** | Pilot Definition & Templates | `app/ui/templates.ts` | ✅ Verified (`npm run build`) |
| **Phase 1** | Identity, Invitations & Inboxes | `app/api/invitations/route.ts` | ✅ Verified (`npm run build`) |
| **Phase 2** | Pre-Flight Review & Evidence | `app/ui/funding-review-modal.tsx` | ✅ Verified (`npm run build`) |
| **Phase 3** | Cancellation & Expiry Refunds | `app/use-live-agreements.ts` | ✅ Verified (`npm run build`) |
| **Phase 4** | Profiles & Repeat Drafts | `app/ui/profile-card.tsx` | ✅ Verified (`npm run build`) |
| **Phase 5** | Off-Ramp Status & Playbook | `PILOT_PLAYBOOK.md`, `app/ui/live-earnings.tsx` | ✅ Verified (`npm run build`) |
