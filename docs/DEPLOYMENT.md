# Deployment procedure

Loydura deploys one product with a strict runtime boundary: Next.js on Vercel, all backend computation on Cloudflare Workers, Supabase PostgreSQL for server-side persistence, private Cloudflare R2 for protected bytes, and Solidity settlement on Elysium Testnet 99801.

## Contracts and Supabase

Use Elysium Testnet chain 99801 and `https://testnet-rpc.elysium.kinetiq.xyz`. Run `forge build` and `forge test -vvv`. Deploy the existing Foundry script only when separately authorized; do not replace immutable contracts for frontend changes. The current Hub and Rewards deployments are source-verified on the explorer and recorded in [TESTNET_EVIDENCE.md](TESTNET_EVIDENCE.md).

Apply `supabase/migrations/0001_initial.sql` to the existing project. The Worker uses `SUPABASE_URL` and the modern `SUPABASE_SECRET_KEY` (`sb_secret_...`) only as Wrangler secrets. Confirm that nonce consumption and rate limiting remain atomic and that RLS stays closed to browser clients.

## Cloudflare Worker

From the repository root:

```text
npm ci
npx wrangler secret put SUPABASE_URL --config apps/worker/wrangler.jsonc --env production
npx wrangler secret put SUPABASE_SECRET_KEY --config apps/worker/wrangler.jsonc --env production
npx wrangler deploy --config apps/worker/wrangler.jsonc --env production
```

The committed `apps/worker/wrangler.jsonc` declares the Hono entry point, compatibility date, observability, production origin/RPC/contract variables, and native `LOYDURA_R2` binding to `loydura-private`. Production currently runs at [loydura-api.delealufejoel.workers.dev](https://loydura-api.delealufejoel.workers.dev), version `3d9c7667-62e1-4b32-a767-f4db3194c13f`. Verify [GET /health](https://loydura-api.delealufejoel.workers.dev/health) returns 200 with all five checks true.

For local development, copy `apps/worker/.dev.vars.example` to ignored `apps/worker/.dev.vars`, run `npm run dev:worker`, and keep `CLOUDFLARE_WORKER_ORIGIN=http://127.0.0.1:8787` in the ignored frontend `.env.local`. Never commit secrets or R2 credentials.

## Vercel

The linked project root is `apps/web`; its install command is `cd ../.. && npm ci` and its build command is `cd ../.. && npm run build`. Production receives only public contract/RPC/WalletConnect values plus `CLOUDFLARE_WORKER_ORIGIN=https://loydura-api.delealufejoel.workers.dev`.

Deploy with the authenticated team scope when the local project link is unavailable:

```text
vercel deploy --prod --yes --scope delealufejoel-4184s-projects
```

The current production deployment is [dpl_HGzS4bd3DytjmadBthrei6mgh6ih](https://vercel.com/delealufejoel-4184s-projects/loydura/HGzS4bd3DytjmadBthrei6mgh6ih), deployed from the release checkout at `4f13f91795a2fe767dbd5277ee39b24d9d416547` and aliased to [loydura.vercel.app](https://loydura.vercel.app). Vercel's `/api/:path*` rewrite is a transport proxy; it does not run API business logic.

## Release verification

Run contract, Worker, frontend, and Playwright suites. Check the production Worker health endpoint, Vercel rewrite responses, anonymous browser access, public contract reads, SIWE cookie attributes, origin rejection, private R2 authorization, and the source-verification links. A green frontend build alone is not release evidence. The current observed results and limitations are in [TESTNET_EVIDENCE.md](TESTNET_EVIDENCE.md).
