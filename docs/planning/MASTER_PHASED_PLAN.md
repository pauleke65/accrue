# Accrue Pilot Blueprint — Master Phased Implementation Plan

This document tracks the complete status of all 6 delivery phases of the **Accrue Pilot Blueprint** and outlines the technical execution plan for the remaining phases.

---

## Overall Phase Roadmap & Status Summary

```text
[Phase 0: Pilot Model & Scope] ──────► COMPLETE
[Phase 1: Real Collaboration & Identity] ► COMPLETE
[Phase 2: Agreement Workspace] ───────► COMPLETE
[Phase 3: Amendments, Expiry & Disputes] ──► NEXT EXECUTION
[Phase 4: Trust, Profiles & Repeat Use] ──► UPCOMING
[Phase 5: Off-Ramp & Hardening] ───────► FINAL
```

| Phase | Description | Status | Key Deliverables |
|---|---|---|---|
| **Phase 0** | Pilot Model & Scope | ✅ Complete | Construction use-case, eligibility, 4 agreement templates defined |
| **Phase 1** | Real Collaboration & Identity | ✅ Complete | One passkey identity, shareable invite links, action inbox, permanent state visibility |
| **Phase 2** | Agreement Workspace | ✅ Complete | Pilot template picker, pre-flight funding review modal, R2 evidence upload with SHA-256 verification |
| **Phase 3** | Amendments, Expiry & Disputes | 🚧 Next | Expiry refund UI, mutual cancellation workflow, agreement duplication/amendment drafts |
| **Phase 4** | Trust, Profiles & Repeat Use | ⏳ Upcoming | Saved counterparties, participant profile cards, exportable PDF/summary receipts |
| **Phase 5** | Off-Ramp & Hardening | ⏳ Upcoming | Nigerian Naira off-ramp status indicator, production incident playbook |

---

## Detailed Execution Plan for Remaining Phases

### Phase 3 — Amendments, Expiry, and Disputes

#### Goal
Handle real-world project changes (expiry, cancellation, revisions) without requiring contract modifications or Accrue custody.

#### Proposed Technical Changes
1. **Expiry & Refund UI Workflow (`app/ui/live-agreements.tsx`)**:
   - Add explicit "Expiry & Refund Status" banner when `block.timestamp >= expiry` or `cancellationVotes == mask`.
   - Add permissionless "Claim Expiry Refund" button for Payer when agreement is expired or cancelled.
2. **Mutual Cancellation Workflow (`app/ui/live-agreements.tsx`)**:
   - Add "Vote to Cancel Agreement" button for active participants (`consentCancellation(id)`).
   - Display cancellation progress badge (e.g. `2 of 3 votes to cancel`).
3. **Agreement Amendment Drafts ("Duplicate & Revise")**:
   - Add "Create Amendment Draft" button on existing agreements.
   - Pre-fills builder with existing scope and milestones so parties can re-issue updated terms for mutual acceptance.

---

### Phase 4 — Notifications, Trust, and Repeat Use

#### Goal
Enable counterparty reuse, participant profile cards, and exportable project summaries.

#### Proposed Technical Changes
1. **Participant Profile Cards (`app/ui/profile-card.tsx`)**:
   - Clickable participant handle (`@tag`) displaying verified address, completed agreements count, and role attestations.
2. **Saved Counterparties & Quick Re-use (`app/ui/live-agreements.tsx`)**:
   - Remember previously interacted `@worker` and `@verifier` tags in browser storage / database for quick auto-complete in builder.
3. **Exportable Agreement Summaries & Receipts (`app/ui/receipt.tsx`)**:
   - Printable / exportable summary view of funded agreement, milestones, evidence digests, and on-chain transaction hashes.

---

### Phase 5 — Financial Endpoints & Production Hardening

#### Goal
Integrate off-ramp tracking and production safety controls.

#### Proposed Technical Changes
1. **Off-Ramp Status Indicator (`app/ui/live-earnings.tsx`)**:
   - Add clear distinction badge: `AUSD Withdrawn (On-Chain)` vs `Bank Payout (NGN Off-Ramp)`.
2. **Production Health & Sponsor Monitoring (`app/api/sponsor/route.ts`)**:
   - Health check endpoint reporting sponsor wallet balance and network RPC latency.

---

## Verification Plan

### Automated Build & Test
```bash
npm run build
```

### Manual Verification
1. **Phase 3 Verification**: Initiate mutual cancellation vote as Worker and Payer; verify status transitions to `cancelled` and refund button unlocks for Payer.
2. **Phase 4 Verification**: Click participant `@tag` to view profile card; test duplicating an agreement into a new draft.
3. **Phase 5 Verification**: Check earnings tab for off-ramp distinction badges.
