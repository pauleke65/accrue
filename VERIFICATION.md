# Verification checkpoint — 12 September 2026

These results describe the source at the sandbox-stabilisation checkpoint. They do not establish live-payment readiness.

| Check | Result | Timing / qualification |
|---|---|---|
| TypeScript: `npx tsc --noEmit` | PASS, exit 0 | Fresh, after the dependency upgrades and UI fixes |
| Domain: `node --test tests/domain.test.mjs` | PASS, 15 tests, 0 failures | Fresh; includes 100 randomized complete journeys |
| Contracts: `forge test` | PASS, 16 tests, 0 failures | Fresh; Solidity 0.8.30; includes 256 conservation fuzz runs |
| Application: Sites `build-site.mjs` | PASS, exit 0 | Fresh; all five build stages completed |
| HTTP: `node tests/api-smoke.mjs` | PASS, 15 checks | Fresh against the local dev server, after every change below |
| Full npm dependency audit | 4 moderate, 0 high | Was 14 findings (10 high, 4 moderate); see below |
| Lint: `npm run lint` | 2 errors, 70 warnings | Both remaining errors are deliberate; see below |
| Colour contrast (WCAG AA) | PASS, 0 failures | Measured with alpha compositing on dashboard, agreement detail and earnings after the Metropolis restyle |
| Browser QA at 360 / 768 / 1024px | PASS, two defects found and fixed | Chromium; complete payer → worker → verifier journey driven at 360px |
| Keyboard: focus order and visible focus | PASS | Activation by Enter/Space not exercised; see below |
| WebMCP runtime validation | UNAVAILABLE | Feature-detected read/navigation tools present |
| Real-wallet / Monad / sponsor end-to-end | NOT IMPLEMENTED OR TESTED | Website remains a sandbox; contract is separate and undeployed |
| Private deployment | NOT COMPLETED | Site registered only; no verified hosted URL |

## HTTP smoke coverage

Unauthenticated access rejection; replayed-creation idempotency; cross-origin mutation rejection; required acceptance and funding; private R2 upload and authorized download; duplicate-upload reuse; evidence changes/resubmission; concurrent approval conflict; atomic worker/verifier allocations; withdrawal; correction; mutual cancellation; unused-reserve refund; reload persistence.

## Dependencies

Ten high-severity advisories were cleared by upgrading React, React DOM and react-server-dom-webpack together to 19.3.0, Next to 16.3.5, vinext to 1.0.0-beta.9, Vite to 8.3.0, `@cloudflare/vite-plugin` to 1.54.8, plugin-rsc to 0.5.34, plugin-react to 6.1.1, wrangler to 4.131.1 and workers-types to 5.20260911.1. The renderer and server-component packages were moved as a set so their versions stay matched.

Four moderate findings remain, all in `drizzle-kit` → `@esbuild-kit/*` → `esbuild`. drizzle-kit 0.31.10 is the latest release and still depends on that deprecated loader, and the only fix npm offers is a breaking downgrade to 0.18.1. The advisory concerns the esbuild development server. `grep` over `dist/` confirms neither drizzle-kit nor `@esbuild-kit` appears in the built Worker bundle; the package is used only by the local `db:generate` command.

Only one copy of React is installed — no nested `node_modules/*/node_modules/react` exists — and a fresh browser tab against the dev server logs no console errors. That closes the earlier open question about duplicate React/hook instances.

## Browser and device QA

Driven in Chromium at 360×780, 768×1024 and 1024px. A complete journey was performed at 360px: create agreement, accept as worker, accept as verifier, fund as payer, submit evidence, approve as verifier, withdraw as worker. Allocations, the earnings split and the reserved balance were correct at each step, and reload persistence was confirmed.

Two defects were found and fixed:

- The agreement detail tab strip measured 367px against a 360px viewport, so the entire page scrolled horizontally at the width the layout rules name explicitly. The strip now scrolls inside its own row; every page measured 0 overflowing elements afterwards.
- The dialog close control was a 16×16 icon, below the 24px minimum target size. It is now a 44px target.

All interactive elements have accessible names, `lang` is set, no image lacks alt text, and no positive `tabindex` distorts the tab order. Focus moves into the first field when a dialog opens, the focus outline is visible (2px brand purple, offset 2px, after the restyle), and Escape closes a dialog.

Enter/Space activation was **not** verified: synthetic key events do not trigger native button activation, so the automation cannot exercise it. The controls are real `<button>` elements, for which activation is handled by the browser. A person should confirm this on a real keyboard.

Not measured: screen readers, slow-network upload behaviour, or any real mobile device.

## Metropolis restyle

The interface follows the Monad Metropolis hackathon page: surface `#0f0f12`, raised panels `#16161a`, paper ink `#fbfaf9`, dimmed ink `#9d9db2`, hairline structure at `#ffffff17`, brand purple `#6e54ff`, square corners, mono uppercase labels at 0.18em tracking, and a pixel display face for page titles. Those colour values are Monad's own published tokens, read from the live page.

The two typefaces are stand-ins: Monad's brittiSans and Metropolis Pixel are not redistributable, so the interface loads Inter for text and Silkscreen for the display role, which is the same substitution the source page's own fallback chain makes.

Every text colour was re-measured against its composited background after the restyle; all three surveyed pages report zero AA failures. Status hues were lifted for the dark surface (`#6ee7a8` positive, `#e8b339` caution, `#ff7a9c` negative) and placeholder ink has its own step at `#8a8a9c`, because the faint hairline value does not clear 4.5:1 as text. Three layout regressions the mono tracking introduced — the role selector, the dashboard filter strip and the mobile navigation — were fixed and re-measured at 360px.

## Lint

Two errors are left deliberately. `Date.now()` is read during render because that is how a milestone decides whether it has expired, and the workspace hook fetches on mount, which the effect rule flags as a synchronous setState. Both are heuristic reports against intentional patterns.

Replacing the brand anchor with `next/link` was attempted and reverted: the vinext link shim resolves a second React copy through dependency optimisation and throws an invalid-hook-call that blanks the page. The rule is disabled on that one line, with the reason recorded in the source.

## Release gate

No independent contract audit, public multi-user authorization validation, real token transfer, sponsor outage test, production evidence-retention review, or actual-device rehearsal has been completed. Do not handle real funds or describe this checkpoint as the finished live P0 product.
