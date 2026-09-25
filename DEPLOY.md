# Accrue — Cloudflare Deployment Guide

## Prerequisites

- Node 22.13+
- `npx wrangler login` (authenticated with Cloudflare)

## Quick Deploy (after first setup)

```bash
npm run build
npx wrangler deploy --config dist/server/wrangler_deploy.json
```

## First-Time Setup

### 1. Create Remote Resources

```bash
# D1 Database
npx wrangler d1 create accrue-db

# R2 Bucket (for milestone evidence uploads)
npx wrangler r2 bucket create accrue-evidence
```

### 2. Update `dist/server/wrangler_deploy.json`

After `npm run build`, create a deploy config from the generated wrangler.json:

```bash
cat dist/server/wrangler.json | python3 -c "
import json, sys
cfg = json.load(sys.stdin)
for db in cfg.get('d1_databases', []):
    if db['binding'] == 'DB':
        db['database_id'] = '<YOUR_D1_DATABASE_ID>'
        db['database_name'] = 'accrue-db'
for b in cfg.get('r2_buckets', []):
    if b['binding'] == 'BUCKET':
        b['bucket_name'] = 'accrue-evidence'
cfg['name'] = 'accrue'
json.dump(cfg, sys.stdout)
" > dist/server/wrangler_deploy.json
```

### 3. Apply Database Migrations

```bash
for m in drizzle/*.sql; do
  npx wrangler d1 execute accrue-db --remote --yes --file="$m"
done
```

> Migrations that were already applied will error with "already exists" — that's safe to ignore.

### 4. Set Secrets

```bash
echo "<value>" | npx wrangler secret put ACCRUE_SPONSOR_KEY --name accrue
echo "<value>" | npx wrangler secret put ENVIO_API_TOKEN --name accrue
echo "<value>" | npx wrangler secret put ENVIO_RPC_TOKEN --name accrue
```

### 5. Deploy

```bash
npx wrangler deploy --config dist/server/wrangler_deploy.json
```

## Current Deployment

| Key              | Value                                          |
|------------------|------------------------------------------------|
| **Live URL**     | https://accrue.accrue-escrow.workers.dev        |
| **Worker Name**  | `accrue`                                       |
| **D1 Database**  | `accrue-db` (`3d626479-43f3-40cc-901d-067e25b8576e`) |
| **R2 Bucket**    | `accrue-evidence`                              |
| **Dashboard**    | https://dash.cloudflare.com/936a0ed4e770b52eb2404166d94ae018/workers/subdomain |

## Verify Remote DB

```bash
npx wrangler d1 execute accrue-db --remote --command="PRAGMA table_list;"
```
