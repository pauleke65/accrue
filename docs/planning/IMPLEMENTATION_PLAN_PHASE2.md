# Implementation Plan — Phase 2: Build the Agreement Workspace

This document outlines the step-by-step technical plan for executing **Phase 2 of the Accrue Pilot Blueprint**: turning Accrue into a rich agreement workspace with construction templates, pre-flight funding review screens, first-class evidence uploads with on-chain SHA-256 verification, and structured review tooling.

---

## Goal Description

Deliver Phase 2 capabilities:
1. **Construction & Service Agreement Templates**: Pre-configured templates in the builder for Nigerian construction/renovation, contractor services, professional delivery, and procurement.
2. **Pre-flight Funding Review Screen**: Detailed review modal before on-chain `fund()` checking AUSD balance, allowance, gas status, and contract terms preview.
3. **First-Class Evidence Packages**: Support uploading multi-format evidence (JPG, PNG, PDF, notes) to R2 with SHA-256 hashing matching on-chain `evidenceHash` for `live_agreements`.
4. **Structured Review & Resubmission**: Clear feedback loop for "Changes Requested" with versioned resubmission.
5. **Agreement Summary & Archive**: Clear financial breakdown (Total Funded, Reserved, Released, Withdrawable) and completion receipt.

---

## User Review Required

> [!IMPORTANT]
> **No Contract Modifications**: As confirmed, `contracts/src/AccrueEscrow.sol` remains 100% untouched. All evidence hashing, template presets, and pre-flight balance checks operate seamlessly on top of the existing deployed escrow contract.

---

## Proposed Changes

### Component 1: Templates & Builder Presets (`app/ui/templates.ts`, `app/ui/live-agreements.tsx`)

#### [NEW] `app/ui/templates.ts`
- Define 4 pilot templates:
  - **Construction & Renovation**: Foundation, Blockwork to Lintel, Roofing, Finishing.
  - **One-off Contractor**: Site Preparation, Main Execution, Final Inspection.
  - **Professional Service Delivery**: Scope & Design, Initial Draft, Final Delivery.
  - **Goods & Procurement**: Materials Sourcing, Logistics & Delivery, On-site Acceptance.

#### [MODIFY] `app/ui/live-agreements.tsx`
- Add template selection dropdown to `Builder`. Selecting a template pre-fills milestone titles, criteria, and estimated amounts.

---

### Component 2: Pre-Flight Funding Review Screen (`app/ui/funding-review-modal.tsx`)

#### [NEW] `app/ui/funding-review-modal.tsx`
- Renders when Payer clicks "Fund agreement".
- Checks:
  - Exact AUSD deposit required vs current Payer AUSD balance.
  - Gas balance vs `GAS_TOPUP_THRESHOLD`.
  - Allowance status vs deposit amount.
- Displays participant addresses, approval rules, expiry date, and contract address before executing `live.fund()`.

---

### Component 3: First-Class Evidence Packages (`app/api/evidence/route.ts`, `app/ui/live-agreements.tsx`)

#### [MODIFY] `app/api/evidence/route.ts`
- Allow uploading evidence for `live_agreements` in addition to sandbox agreements.
- Verify uploader's address matches a participant (`payer`, `worker`, `verifier`) on the agreement.

#### [MODIFY] `app/ui/live-agreements.tsx`
- Attach file uploader directly in the Milestone Evidence Submission block.
- Calculate SHA-256 hash of evidence notes + file digests to bind on-chain `submitEvidence(id, milestone, evidenceHash)`.
- Display verified evidence badge matching on-chain hash.

---

### Component 4: Structured Review & Completion Summary (`app/ui/live-agreements.tsx`)

#### [MODIFY] `app/ui/live-agreements.tsx`
- Add structured feedback text box when Verifier/Payer clicks "Request Changes".
- Add **Financial Summary Bar** showing: Total Deposit, Reserved, Released, Earned, Withdrawable.

---

## Verification Plan

### Automated Tests
1. **Build & Type Check**:
   ```bash
   npm run build
   ```

### Manual Verification
1. **Template Selection**: Select "Construction & Renovation" in builder; verify milestones pre-fill cleanly.
2. **Pre-Flight Funding Review**: Attempt funding with sufficient/insufficient AUSD; verify warning banner appears if balance is low.
3. **Evidence Upload & Submission**: Upload a site photo/PDF evidence; submit milestone; verify SHA-256 digest is recorded on-chain and visible in review mode.
