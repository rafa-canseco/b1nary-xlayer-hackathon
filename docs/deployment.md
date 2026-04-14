# Hackathon Deployment Plan

Use separate disposable services for the hackathon deployment. Do not reuse production b1nary services or databases.

## Targets

| Component | Platform | Suggested name |
| --- | --- | --- |
| Frontend | Vercel | `b1nary-xlayer-hackathon` |
| Backend API | Railway | `b1nary-xlayer-backend` |
| Market maker | Railway | `b1nary-xlayer-market-maker` |
| Database | Supabase | `b1nary-xlayer-hackathon` |
| Frontend domain | DNS/Vercel | `xlayer.b1nary.app` |

## Frontend

Deploy `frontend/` as the Vercel project root.

Environment variables:

```text
NEXT_PUBLIC_CHAIN_ID=1952
NEXT_PUBLIC_RPC_URL=https://testrpc.xlayer.tech/terigon
NEXT_PUBLIC_API_URL=<Railway backend URL>
NEXT_PUBLIC_PRIVY_APP_ID=<public Privy app id>
NEXT_PUBLIC_BUILDER_CODE=<optional builder code>
NEXT_PUBLIC_ADDRESS_BOOK_ADDRESS=0x8Bb949cE0ee8129A64841a88B1a5de62de3E2F5e
NEXT_PUBLIC_CONTROLLER_ADDRESS=0x75701c1A79Ea45F8BDE9A885A84a7581672d4820
NEXT_PUBLIC_MARGIN_POOL_ADDRESS=0x3b14faD41CcbD471296e11Ea348dC303aA3A4156
NEXT_PUBLIC_OTOKEN_FACTORY_ADDRESS=0x7C9418a13462174b2b29bc0B99807A13B9731690
NEXT_PUBLIC_ORACLE_ADDRESS=0xE3E0bcD6ea5b952F98afcb89D848962100127db1
NEXT_PUBLIC_WHITELIST_ADDRESS=0x16e505DBeE21fD1EFDb8402444e70840af6D6FBa
NEXT_PUBLIC_BATCH_SETTLER_ADDRESS=0x6aea5B95d64962E7F001218159cB5fb11712E8B1
NEXT_PUBLIC_USDC_ADDRESS=0x4A881f3f745B99f0C5575577D80958a5a16b7347
NEXT_PUBLIC_WETH_ADDRESS=0x1B5D20CcA8D0B8F5FB25aA06735a57E1B104A1A8
NEXT_PUBLIC_WBTC_ADDRESS=0x1B5D20CcA8D0B8F5FB25aA06735a57E1B104A1A8
NEXT_PUBLIC_MOKB_ADDRESS=0x1B5D20CcA8D0B8F5FB25aA06735a57E1B104A1A8
NEXT_PUBLIC_SWAP_ROUTER_ADDRESS=0x700c01dEe9bb9a41899b53D08856DAD5147eF8E7
NEXT_PUBLIC_SHOW_FAUCET=true
```

`xlayer.b1nary.app` can point to this Vercel project even though the repo is separate. Add the domain in Vercel, then add the DNS record requested by Vercel in the DNS provider for `b1nary.app`.

Typical DNS shape:

```text
xlayer CNAME cname.vercel-dns.com
```

Use the exact Vercel instruction if it differs.

## Backend

Deploy `backend/` as a Railway service with a separate hackathon Supabase project.

Required categories of variables:

- XLayer RPC and contract addresses.
- Supabase URL and service role key for the hackathon database.
- Operator private key for faucet/bots.
- Beta/testnet mode enabled.
- CORS origins including `https://xlayer.b1nary.app`.

## Market Maker

Deploy `market-maker/` as a separate Railway service.

Use a new disposable MM wallet for the hackathon. It must be funded, whitelisted, and approved:

1. Fund with OKB testnet gas.
2. Mint MockOKB and MockUSDC.
3. Whitelist as maker in BatchSettler.
4. Approve MockOKB and MockUSDC to MarginPool.
5. Set `XLAYER_ASSETS=okb`.

## Supabase

Create a new Supabase project just for the hackathon. Apply migrations from `backend/supabase/migrations/`.

Keep this database separate from production and staging because the faucet and event indexer write demo data.

## Teardown

After the hackathon:

1. Remove Vercel project/domain.
2. Delete Railway backend and market-maker services.
3. Delete Supabase project.
4. Rotate or discard all hackathon keys.
