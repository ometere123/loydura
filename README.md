# LOYDURA

Loydura is one Elysium Testnet product: token-paid creator memberships plus creator-funded USDC commitment campaigns. The approved product screens are Discover, Creator Store, Campaign, Creator Studio, and My Dashboard, presented through a dedicated public homepage.

## Route map

- `/` — independent product homepage and risk-aware product explanation.
- `/discover` — bounded storefront search and live campaign discovery.
- `/shop/[id]` — creator storefront, membership checkout, protected content, and linked campaigns.
- `/campaign/[id]` — live campaign accounting, position state, claims, exits, and principal recovery.
- `/studio` — wallet-owned storefront discovery, creation, content publishing, and campaign funding.
- `/me` — wallet activity, memberships, positions, accrued estimates, and settlement actions.

## Final runtime architecture

- Vercel hosts only the Next.js frontend and client-side wallet/Web3 interface.
- Cloudflare Worker apps/worker owns every /api/* endpoint, SIWE, sessions, authorization, Supabase access, R2 delivery, and server-side Elysium reads.
- Supabase PostgreSQL stores nonces, hashed sessions, shop metadata, content metadata, and rate-limit buckets.
- Private Cloudflare R2 bucket loydura-private is exposed only through the native LOYDURA_R2 Worker binding.
- Solidity contracts settle membership payments and custody/reward accounting on Elysium Testnet chain 99801.
- Vercel rewrites /api/* to CLOUDFLARE_WORKER_ORIGIN; this is routing only and does not execute backend logic on Vercel.

No Next.js API routes, Server Actions, Vercel Functions, Supabase secret keys, or R2 credentials belong in apps/web.

## Local development

1. Read docs/SECURITY.md and docs/DEPLOYMENT.md.
2. Install dependencies with npm install.
3. Install the pinned Foundry libraries in contracts/, then run npm run test:contracts.
4. Copy apps/web/.env.example to apps/web/.env.local and apps/worker/.dev.vars.example to apps/worker/.dev.vars. Replace placeholders only in ignored local files.
5. Apply supabase/migrations/0001_initial.sql to the existing Supabase project and create the private R2 bucket.
6. Start the Worker with npm run dev:worker, then the frontend with npm run dev. Local frontend rewrites point to Wrangler at 127.0.0.1:8787.

Useful checks:

    npm run typecheck
    npm run lint
    npm run build
    npm run test:worker
    npm run test:contracts
    npm run test:e2e

Frontend design and interaction decisions are documented in [docs/FRONTEND_DESIGN.md](docs/FRONTEND_DESIGN.md).

The contracts include unrestricted mint test fixtures only. They are not production stablecoins. No mainnet launch, real-money custody, audit, partnership, or live deployment is claimed without evidence in docs/TESTNET_EVIDENCE.md.

Repository target: https://github.com/ometere123/loydura

## Observed testnet deployment

The verified testnet endpoints currently used for integration evidence are [loydura.vercel.app](https://loydura.vercel.app) for the frontend and [loydura-api.delealufejoel.workers.dev](https://loydura-api.delealufejoel.workers.dev) for the Cloudflare Worker. The latest release source on `main` is commit `c2c6a669d275bda135ab95613e6a950c1960578f`; deployment IDs, addresses, test results, lifecycle transactions, screenshots, and residual blockers are maintained in [docs/TESTNET_EVIDENCE.md](docs/TESTNET_EVIDENCE.md). The Worker health endpoint reports Supabase, private R2, Elysium RPC, and deployed-contract readiness. All deployed tokens in this evidence are explicitly labeled test-only assets.
