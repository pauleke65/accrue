# Accrue

Fund the job. Agree what completion means. Pay when the work is verified.

A private, persistent payment-workflow sandbox for Monad Metropolis Track 2, with a separate tested Solidity escrow. **No real funds, wallets, or sponsor services are connected to the web app.**

## Explore the product

Sign in, create an agreement or choose the renovation example, and switch between Payer, Worker, and Verifier views. Accept the fixed terms, fund the agreement, submit evidence, approve work, and withdraw the earned allocations. Try requesting changes, mutual cancellation, or expiry refunds. Download receipts and inspect the activity record.

The role switcher is an explicit simulation inside your own workspace, not live participant authentication.

## Run locally

Requires Node 22.13+ and npm; Foundry is required only for contracts.

```sh
npm ci
npm run build
```

For a **fresh local database only**, apply each migration once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_glorious_nuke.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_striped_newton_destine.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_robust_mathemanic.sql
npm run dev
```

Visit the printed loopback URL. The local sign-in route provides a synthetic identity; hosted authentication is handled by the platform. Production deployments package and apply their own migrations.

## Verify

```sh
node --test tests/domain.test.mjs
npx tsc --noEmit
node tests/api-smoke.mjs
cd contracts
forge test -vv
```

The API smoke test needs the running local dev server and creates synthetic test records. No live network deployment is needed for the contract tests.

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for architecture, security boundaries, deployment preparation, and the remaining live-release requirements. The contract is unaudited and must not hold real funds without independent review. Sponsor integrations, participant invitations, gas sponsorship, and chain-backed UI settlement remain activation/development gates—not completed features.
