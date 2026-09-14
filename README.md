# Accrue

**Fund the job. Agree what completion means. Get paid when the work is verified.**

Someone abroad pays for building work at home and cannot see it. The builder
wants to know the money exists before starting. Accrue holds the money in a
contract, and an agreed professional — a site engineer both sides already
trust — confirms each milestone. Approval pays the worker and the verifier in
the same transaction, and the payer cannot reclaim what has been earned.

Built for **Monad Metropolis, Track 2 — Consumer Products & Payments.**

## What is real

Running on **Monad testnet** with **AUSD**, Agora's dollar stablecoin.

| | |
|---|---|
| Accounts | **Mera** passkeys. One ceremony, no seed phrase, no extension, no custody backend. One passkey derives a separate account per role. |
| Money | **AUSD** transfers settling in about a second, and an escrow contract holding deposits until work is verified. |
| Escrow | [`0xf8c44A529cd0470597C7865d2B2473abff65d0De`](https://testnet.monadvision.com/address/0xf8c44A529cd0470597C7865d2B2473abff65d0De) — bound at construction to AUSD, so it can never pay in another token. |
| History | **Envio** HyperSync and HyperRPC. The public RPC caps log queries at 100 blocks; Envio answers over the whole chain. |
| Fees | Sponsored. A new account holds no MON, so the first network fee is paid for it. |
| Names | Payment tags. You pay `@bola`, not a 42-character address. |

Test money on a test network. The contract has had no independent audit and
must not hold real funds. The app says which parts are live, which are
simulated, and which are not built, on its own Connections page.

## Two things sit side by side

**Funded jobs** is the product: real AUSD, real escrow, three roles that each
sign for themselves. Every figure on screen is read from the contract, so the
app cannot disagree with the money.

**Sandbox** is the same workflow against a private ledger, for walking the
process without spending anything. It is labelled as such throughout.

## Run it

Node 22.13+. Foundry only for the contracts.

```sh
npm ci
npm run build
```

For a **fresh database only**, apply each migration once:

```sh
for m in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --config dist/server/wrangler.json \
    --persist-to .wrangler/state --file "$m"
done
npm run dev
```

Then open the printed loopback URL and sign in with a passkey.

### Optional configuration

Each of these degrades honestly: without it the app says what it cannot do
rather than failing or pretending. All go in `.dev.vars`, which is gitignored.

| Variable | What it unlocks | Where from |
|---|---|---|
| `ACCRUE_SPONSOR_KEY` | Paying a new account's first network fee, and claiming test AUSD for it | A funded testnet key; `node scripts/deployer.mjs` prints an address, fund it at [faucet.monad.xyz](https://faucet.monad.xyz) |
| `ENVIO_API_TOKEN` | Payment history across the whole chain | [app.envio.dev/api-tokens](https://app.envio.dev/api-tokens) |
| `ENVIO_RPC_TOKEN` | Range reads the public RPC refuses | Same |
| `AGORA_API_KEY` | Cash-out to a bank account via Agora routes | An Agora organisation key; also needs a verified bank account and an approved wallet entitlement |

Agora's supply metrics need no key and always work.

[.env.example](./.env.example) documents each one. `node scripts/print-env.mjs`
shows what this machine has set, masked; add `--reveal` to print the values
for a secrets manager.

## Verify

```sh
node --test tests/domain.test.mjs tests/chain.test.mjs
npx tsc --noEmit
node tests/api-smoke.mjs                 # needs the dev server
node tests/tags-smoke.mjs                # claim, resolve, forgery, replay
node tests/sponsor-smoke.mjs             # needs a funded sponsor key
node tests/chain-live.mjs                # read-only, no key needed
node tests/live-agreement-smoke.mjs      # funds a real testnet job end to end
cd contracts && forge test -vv
```

[VERIFICATION.md](./VERIFICATION.md) records what has actually been run,
including a three-account escrow journey on testnet and the transaction
hashes it produced.

## Reading further

- [DEMO.md](./DEMO.md) — a shooting script for a three-minute walkthrough, and
  a full feature checklist.
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — architecture, security
  boundaries, and what remains before this could handle real money.
- [docs/PRODUCT-REQUIREMENTS.md](./docs/PRODUCT-REQUIREMENTS.md) — the product
  specification this was built against.

## What this does not do

It does not prove physical work happened — a named person judges that, and the
record of their attestations is a history, not a trust score. It does not reach
a bank account. It is not audited. Payment tags resolve through Accrue's own
directory, so a tag stops resolving if the app goes away, though the account
behind it keeps working.

The product is more convincing with those stated than without.
