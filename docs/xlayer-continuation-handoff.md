# XLayer Hackathon Continuation Handoff

This is the working handoff for continuing the XLayer hackathon deployment from
Codex or Claude Code. Do not paste private keys, Supabase service-role keys, or
database passwords into Linear, commits, or docs.

## Current State

- Repo: `/Users/rafa/Desktop/SoftwareDevelopment/personal/options/b1nary-xlayer-hackathon`
- Latest confirmed commit: `3dd1996 fix: make Supabase schema XLayer-ready`
- Supabase project ref: `yjvmvafjxeatmcolaoik`
- Supabase URL: `https://yjvmvafjxeatmcolaoik.supabase.co`
- Applied `backend/src/db/schema.sql` to the new Supabase project through the
  IPv4 pooler with `supabase db push`.
- Verification via `supabase db dump` is blocked locally because Docker Desktop
  is not running. The push itself completed successfully.
- The schema pasted from the previous Supabase project is reference only. It
  should not be run against the new project.

## Runtime Services

Deploy three services for the demo:

1. Backend API on Railway from `backend/`.
2. Market maker bot on Railway from `market-maker/`.
3. Frontend on Vercel or Railway from `frontend/`.

Keep the database as the separate hackathon Supabase project.

## Environment Files

Use these files as the source of truth for variable names:

- Backend local/Railway: `backend/.env.xlayer.example`
- Market maker local/Railway: `market-maker/.env.xlayer.example`
- Frontend local/Vercel: `frontend/.env.xlayer.example`
- Contracts/deploy scripts: `contracts/.env.example`

Runtime `.env` files are gitignored. Copy examples to local `.env` files only
when needed.

## Backend Variables

Set these in Railway for the backend service:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BETA_MODE=true`
- `CHAIN_ID=1952`
- `ALLOWED_ORIGINS`
- `API_BASE_URL`
- `XLAYER_RPC_URL=https://testrpc.xlayer.tech/terigon`
- `XLAYER_CHAIN_ID=1952`
- `OPERATOR_PRIVATE_KEY`
- `WOKB_ADDRESS`
- `XLAYER_USDC_ADDRESS`
- `CHAINLINK_OKB_USD_ADDRESS`
- `MOCK_CHAINLINK_FEED_ADDRESS`
- `XLAYER_BATCH_SETTLER_ADDRESS`
- `XLAYER_CONTROLLER_ADDRESS`
- `XLAYER_OTOKEN_FACTORY_ADDRESS`
- `XLAYER_MARGIN_POOL_ADDRESS`
- `XLAYER_ORACLE_ADDRESS`
- `XLAYER_WHITELIST_ADDRESS`

Optional backend variables:

- `XLAYER_WSS_RPC_URL`
- `DEMO_API_KEY`
- `RESEND_API_KEY`
- `UNSUBSCRIBE_SECRET`

## Market Maker Variables

Set these in Railway for the market-maker service:

- `MM_PRIVATE_KEY`
- `MM_API_KEY`
- `BACKEND_URL`
- `RPC_URL=https://testrpc.xlayer.tech/terigon`
- `CHAIN_ID=1952`
- `BATCH_SETTLER`
- `USDC_ADDRESS`
- `MARGIN_POOL_ADDRESS`
- `ASSETS=okb`
- `XLAYER_RPC_URL=https://testrpc.xlayer.tech/terigon`
- `XLAYER_CHAIN_ID=1952`
- `XLAYER_BATCH_SETTLER`
- `XLAYER_USDC_ADDRESS`
- `XLAYER_MARGIN_POOL_ADDRESS`
- `XLAYER_ASSETS=okb`
- `HEDGE_MODE=simulate`
- `HYPERLIQUID_TESTNET=true`

Optional:

- `SUPABASE_URL`
- `SUPABASE_KEY`

## Frontend Variables

Set these in Vercel or the frontend host:

- `NEXT_PUBLIC_CHAIN_ID=1952`
- `NEXT_PUBLIC_RPC_URL=https://testrpc.xlayer.tech/terigon`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_BUILDER_CODE`
- `NEXT_PUBLIC_ADDRESS_BOOK_ADDRESS`
- `NEXT_PUBLIC_CONTROLLER_ADDRESS`
- `NEXT_PUBLIC_MARGIN_POOL_ADDRESS`
- `NEXT_PUBLIC_OTOKEN_FACTORY_ADDRESS`
- `NEXT_PUBLIC_ORACLE_ADDRESS`
- `NEXT_PUBLIC_WHITELIST_ADDRESS`
- `NEXT_PUBLIC_BATCH_SETTLER_ADDRESS`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_WETH_ADDRESS`
- `NEXT_PUBLIC_WBTC_ADDRESS`
- `NEXT_PUBLIC_MOKB_ADDRESS`
- `NEXT_PUBLIC_SWAP_ROUTER_ADDRESS`
- `NEXT_PUBLIC_SHOW_FAUCET=true`

## Next Steps

1. Verify Supabase tables from the dashboard SQL editor or by starting Docker
   Desktop and running `supabase db dump`.
2. Add backend variables in Railway and deploy `backend/`.
3. Smoke test backend:
   - `GET /health`
   - `GET /prices?asset=okb`
   - `POST /faucet/xlayer`
4. Create or confirm an MM API key in `mm_api_keys`.
5. Add market-maker variables in Railway and deploy `market-maker/`.
6. Confirm quotes are written into `mm_quotes` with `chain='xlayer'` and
   `asset='okb'`.
7. Add frontend variables and deploy `frontend/`.
8. Run demo flow:
   - connect wallet on XLayer testnet
   - claim faucet
   - load OKB quotes
   - approve collateral
   - execute quote through `BatchSettler`
   - capture XLayer explorer transaction as proof.

## Known Blockers

- Local `supabase db dump` cannot verify schema until Docker Desktop is running.
- Supabase direct database host was IPv6-only from this environment; use the
  IPv4-compatible pooler for database maintenance.
- The local Supabase CLI account is linked to another account/org, so do not
  rely on `supabase link` for this project unless auth is switched.
