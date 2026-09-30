# Implementation Plan — Metropolis Design System UI Refactoring

This document outlines the technical plan to refactor all newly added UI components so they **100% align with Accrue's Monad Metropolis Design System** (`app/globals.css`).

---

## Goal Description

Refactor new components (`FundingReviewModal`, `InvitationAcceptModal`, `ProfileCard`, `ActionInboxBanner`, `PilotTemplatesPicker`, `OffRampNotice`) from mixed Tailwind classes to native Metropolis CSS rules:
- **Zero Rounded Corners**: Replace all `rounded-lg`, `rounded-full`, and `rounded` with square edges (`border-radius: 0`).
- **Monad Metropolis Palette**: Use `--m-raised`, `--m-surface`, `--m-hairline`, `--m-purple`, `--m-positive` (`#6ee7a8`), and `--m-negative` (`#ff7a9c`).
- **Consistent Modal Backdrops**: Use `.receipt-backdrop` fixed overlay with `color-mix(in srgb, var(--m-void) 82%, transparent)`.
- **Native Layout Classes**: Use `.panel`, `.notice`, `.action-banner`, `.eyebrow`, `.mono-label`, `.page-heading`.

---

## Proposed Changes

### Component 1: Modals (`app/ui/funding-review-modal.tsx`, `app/ui/invitation-accept-modal.tsx`, `app/ui/profile-card.tsx`)

#### [MODIFY] `app/ui/funding-review-modal.tsx`
- Replace Tailwind colors (`text-green-600`, `text-red-600`) with native `--m-positive` and `--m-negative`.
- Replace backdrop with `.receipt-backdrop` overlay.
- Enforce square edges (`border-radius: 0`) and `.panel` styling.

#### [MODIFY] `app/ui/invitation-accept-modal.tsx`
- Replace `rounded-lg` & Tailwind utility padding with Metropolis modal structure.
- Style assigned role badge with native `.badge` / `.eyebrow` styling.

#### [MODIFY] `app/ui/profile-card.tsx`
- Replace `rounded-full` avatar with square Metropolis mono avatar (`width: 48px; height: 48px; border: 1px solid var(--m-purple)`).
- Style address copy field with `.mono` hairline treatment.

---

### Component 2: Dashboard Banners & Controls (`app/ui/live-agreements.tsx`, `app/ui/live-earnings.tsx`)

#### [MODIFY] `app/ui/live-agreements.tsx`
- **ActionInboxBanner**: Style with `border-left: 2px solid var(--m-purple); background: var(--m-raised); border-radius: 0;`.
- **Pilot Templates Picker**: Remove Tailwind flex gaps; align buttons with native `.secondary` styling.
- **Cancellation & Refund Panel**: Refactor to match `.action-banner` / `.panel` treatment with crisp hairline dividers.

#### [MODIFY] `app/ui/live-earnings.tsx`
- **Off-Ramp Status Indicator**: Refactor `.notice` block with native typography and hairline borders.

---

## Verification Plan

### Automated Build Check
```bash
npm run build
```

### Manual Visual Verification
1. **Modal Backdrops**: Open `FundingReviewModal`, `InvitationAcceptModal`, and `ProfileCard`. Verify zero rounded corners and dark Metropolis backdrop.
2. **Dashboard Inboxes & Banners**: Inspect Action Inbox and Pilot Templates in the builder; verify square edges and Monad purple accents.
3. **Color Contrast**: Verify status indicators use `--m-positive` (`#6ee7a8`) and `--m-negative` (`#ff7a9c`).
