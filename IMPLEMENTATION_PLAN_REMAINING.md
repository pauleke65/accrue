# Implementation Plan — Remaining Phases 4 & 5: Trust, Repeat Use, & Off-Ramp Hardening

This document outlines the step-by-step technical plan for executing the remaining **Phase 4** and **Phase 5** deliverables of the **Accrue Pilot Blueprint**.

---

## Goal Description

Deliver final blueprint capabilities:
1. **Participant Profile Cards (`app/ui/profile-card.tsx`)**: Display participant handle (`@tag`), verified address, active/completed agreement counts, and role participation.
2. **Duplicate Draft Action (`app/ui/live-agreements.tsx`)**: "Duplicate as New Draft" button on agreement pages pre-filling the builder for repeat contracts.
3. **Printable Summary Receipt (`app/ui/receipt.tsx`)**: Printable agreement summary and payment breakdown with SHA-256 evidence digests and on-chain tx links.
4. **Off-Ramp Status Indicator (`app/ui/live-earnings.tsx`)**: Clear UI distinction between on-chain AUSD withdrawals and Nigerian Bank Payouts (NGN off-ramp status).
5. **System Health & Playbook (`app/api/sponsor/route.ts`, `PILOT_PLAYBOOK.md`)**: Health check endpoint and pilot operating playbook.

---

## Proposed Changes

### Component 1: Participant Profile Cards & Tag Inspector (`app/ui/profile-card.tsx`, `app/ui/live-agreements.tsx`)

#### [NEW] `app/ui/profile-card.tsx`
- Modal or popover rendering when clicking a `@tag`:
  - Tag name and verified EVM address.
  - Number of agreements participated in (as Payer, Worker, or Verifier).
  - Copy address action.

#### [MODIFY] `app/ui/live-agreements.tsx`
- Make participant handles (`@workerTag`, `@verifierTag`, `@payer`) clickable to open `<ProfileCard />`.
- Add "Duplicate as New Draft" button on agreement details page.

---

### Component 2: Exportable Agreement Receipt (`app/ui/receipt.tsx`)

#### [MODIFY] `app/ui/receipt.tsx`
- Add printable agreement summary layout (`window.print()` compatible):
  - Job Title, Scope, Expiry, and Contract Address.
  - Milestone Payment Table with amounts, status, and verified evidence digests.
  - Participant tags and transaction hashes.

---

### Component 3: Off-Ramp Status & Hardening (`app/ui/live-earnings.tsx`, `app/api/sponsor/route.ts`, `PILOT_PLAYBOOK.md`)

#### [MODIFY] `app/ui/live-earnings.tsx`
- Add status breakdown badge: `AUSD Withdrawn (On-Chain)` vs `Bank Payout (NGN Off-Ramp Ready)`.

#### [NEW] `PILOT_PLAYBOOK.md`
- Operating guide for pilot support: lost access handling, transaction troubleshooting, dispute coordination, and risk limits.

---

## Verification Plan

### Automated Tests
```bash
npm run build
```

### Manual Verification
1. **Profile Card**: Click `@bola` or `@ngozi` handle in agreement tile; verify profile modal opens with verified address and agreement stats.
2. **Duplicate Draft**: Click "Duplicate as Draft" on an existing job; verify builder opens with pre-filled title, scope, and milestones.
3. **Printable Receipt**: Click "Export Receipt"; verify printable summary displays complete milestone payment breakdown.
4. **Off-Ramp Badge**: Open Earnings page; verify off-ramp status badge renders correctly.
