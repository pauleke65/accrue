# Implementation Plan — UI Clarity & Product Explainer Redesign

This document outlines the design and copy plan to make **Accrue's product purpose, roles, and workflow 100% clear** to first-time and returning users.

---

## Goal Description

Eliminate abstract jargon ("workspace session", "network reading", "smart contract hashes") and replace them with clear, human-friendly explainers across the product:
1. **Landing & Onboarding Explainer (`app/workspace.tsx`)**: Replace dry passkey instructions with a clear headline and visual 3-step explainer card (*Set Milestones ➔ Lock Funds ➔ Verify & Release*).
2. **Dashboard Workflow Guide (`app/ui/live-agreements.tsx`)**: Add a subtle, clean "How Escrow Protection Works" guide detailing the 3 roles (*Payer*, *Worker*, *Verifier*).
3. **Builder Clarity (`app/ui/live-agreements.tsx`)**: Add clear microcopy explaining how milestone deposits are locked and how verification releases funds.

---

## Proposed Changes

### Component 1: Landing & Onboarding Explainer (`app/workspace.tsx`)

#### [MODIFY] `app/workspace.tsx`
- Replace dry passkey text with plain-language value proposition:
  ```html
  <h1>Secure milestone escrow for your projects.</h1>
  <p>Accrue holds project funds in a secure digital vault. Money is released step-by-step only after work is verified and approved.</p>
  ```
- Render a 3-step visual workflow card:
  1. **Define Milestones**: Agree on job steps and payment amounts.
  2. **Lock Deposit**: Payer deposits funds into the secure vault.
  3. **Verify & Pay**: Worker submits proof, Verifier approves, and funds release instantly.

---

### Component 2: Dashboard Escrow Guide (`app/ui/live-agreements.tsx`)

#### [MODIFY] `app/ui/live-agreements.tsx`
- Add a clean, collapsible **"How Escrow Protection Works"** guide card at the top of the Agreements view explaining:
  - **Payer**: Funds the agreement vault up front so the worker knows payment is guaranteed.
  - **Worker**: Complete milestones and uploads photo/document proof.
  - **Verifier**: Inspects completed work and approves funds for release.

---

### Component 3: Builder Role Clarity (`app/ui/live-agreements.tsx`)

#### [MODIFY] `app/ui/live-agreements.tsx`
- Add clear field labels and tooltips in `Builder`:
  - *Worker Handle*: "Who will complete the work and earn this payment?"
  - *Verifier Handle*: "Who will inspect and approve work before money is released?"

---

## Verification Plan

### Automated Build Check
```bash
npm run build
```

### Manual Verification
1. **Landing Page Inspection**: Log out / view initial workspace; verify clear 3-step visual explainer renders prominently.
2. **Dashboard Guide**: View Agreements page; verify role roles (*Payer*, *Worker*, *Verifier*) are clearly defined in plain language.
