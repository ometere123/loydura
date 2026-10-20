# Deployment procedure

Deployment is evidence-driven. Never put private keys, SUPABASE_SECRET_KEY, R2 credentials, or deployment-only values in source control.

## 1. Contracts and Supabase

Use Elysium Testnet chain 99801 and the configured public RPC. Run forge build and forge test -vvv, deploy with the existing Foundry script only when authorized, verify source on the official explorer, and record addresses plus transaction hashes in docs/TESTNET_EVIDENCE.md.

Apply supabase/migrations/0001_initial.sql to the existing project. The Worker uses the modern SUPABASE_SECRET_KEY (sb_secret_...) server-side. Confirm the nonce and rate-limit RPCs are atomic and that RLS remains closed to anonymous/authenticated browser clients.

## 2. Worker

From apps/worker:

    npm run types
    wrangler secret put SUPABASE_URL
    wrangler secret put SUPABASE_SECRET_KEY
    wrangler secret put APP_ORIGIN
    wrangler secret put ELYSIUM_RPC_URL
    wrangler secret put LOYDURA_HUB_ADDRESS
    wrangler secret put LOYDURA_REWARDS_ADDRESS
    wrangler secret put LOYDURA_USDC_ADDRESS
    wrangler deploy

The committed wrangler.jsonc declares the Worker entry point, compatibility date, observability, and native LOYDURA_R2 binding to loydura-private. Keep production values in Wrangler configuration/secrets, not .env files. The Worker must answer GET /health with status ok only after config, Supabase, R2, and chain readiness are verified.

For local development, use ignored .dev.vars and wrangler dev; .dev.vars.example contains placeholders only.

## 3. Vercel

Deploy apps/web as the Vercel project root with the public values in apps/web/.env.example and CLOUDFLARE_WORKER_ORIGIN set to the deployed Worker origin. Vercel must not receive Supabase secret keys, wallet keys, R2 credentials, or backend-only configuration. The Next config rewrites /api/:path* to the Worker.

Validate the browser domain, Worker APP_ORIGIN, forwarded Set-Cookie, HTTPS Secure behavior, and same-origin SIWE before accepting the deployment.

## 4. Release proof

Run contract, Worker, Supabase, frontend, and Playwright suites. Then test real browser login, logout, creator authorization, 12 MiB upload limits, private download streaming, expired-member denial, cross-shop isolation, and the complete membership/campaign lifecycle on testnet. Record URLs, hashes, receipts, health output, and CI runs. A green frontend build alone is not release evidence.

