# Testnet evidence ledger

This file records observed evidence only. Unknown values remain blockers.

| Gate | Status | Evidence |
|---|---|---|
| Solidity compile | VERIFIED LOCALLY | Foundry build passed after pinned OpenZeppelin 5.2.0 and forge-std 1.9.7 installation. |
| Solidity test suite | VERIFIED LOCALLY | 19 tests passed; invariant/fuzz depth and external live lifecycle still require separate evidence. |
| Worker typecheck/build | VERIFIED LOCALLY | Generated Wrangler bindings, Worker typecheck, and `wrangler deploy --dry-run` passed; dry-run confirmed the native `LOYDURA_R2` binding. |
| Worker security/integration tests | PARTIAL | Worker runtime tests pass (6 tests), including filename/magic-byte validation, origin/CSRF rejection, and degraded health behavior. Supabase/R2 integration needs configured test services. |
| Frontend typecheck/lint/build | VERIFIED LOCALLY | Frontend typecheck, source-scoped lint, and Next production build passed. Build emitted only optional wallet-library and CSS warnings. |
| Supabase migration/RLS | NOT VERIFIED | Requires access to the existing Supabase project. |
| Private R2 upload/download | PARTIAL | The private `loydura-private` bucket was provisioned in the authenticated Cloudflare account on 2026-10-21; Worker-bound upload/download authorization still requires a deployed Worker and runtime test. |
| Elysium Hub deployment | NOT DEPLOYED / UNKNOWN | Address and transaction must be recorded from an authorized deployment. |
| Elysium Rewards deployment | NOT DEPLOYED / UNKNOWN | Address and transaction must be recorded from an authorized deployment. |
| Vercel frontend deployment | NOT DEPLOYED / UNKNOWN | URL and rewrite/cookie evidence required. |
| Cloudflare Worker deployment | NOT DEPLOYED / UNKNOWN | URL, /health output, Supabase/R2/RPC checks required. |
| Browser SIWE and production cookies | NOT VERIFIED | Requires deployed frontend and Worker. |
| Full membership/campaign lifecycle | NOT VERIFIED | Requires funded testnet wallets and receipt evidence. |
| Local Wrangler development | VERIFIED LOCALLY | Wrangler served `/health` with an expected 503 degraded response when secrets/contracts were absent and rejected a hostile origin with 403. |
| CI | VERIFIED REMOTELY | GitHub Actions run [39520059448](https://github.com/ometere123/loydura/actions/runs/39520059448) passed contracts, Worker, and web jobs, including the frontend Playwright suite. |
| Ascend submission | NOT CLAIMED | No partnership, token launch, audit, or competition acceptance is inferred. |

## Blockers

Do not mark the release ready until the external Supabase, Cloudflare, Vercel, GitHub, and Elysium evidence is attached and the complete security/browser/lifecycle suites pass.

