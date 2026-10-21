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
| Elysium deployer funding | VERIFIED ON TESTNET | Bridge transaction [0xc62f7b…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xc62f7bff5ab316f7ba1b98577b6857874aa1ae7e6bdbe2953214604feadc81c3) succeeded and credited 0.1 native HYPE to the configured deployer on chain 99801. |
| Elysium Hub deployment | VERIFIED ON TESTNET | `0x12B48836E495F863F40212f40aEc7372388345a4`; transaction [0xb31ed7…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xb31ed795f2ff82c5e4cb5a253eebb6bfa3dfeaaa9f1b9f6c87f865421b91f72a) succeeded in block 12488301; deployed code verified. |
| Elysium Rewards deployment | VERIFIED ON TESTNET | `0x3aaE1d1f9E751996aA3CaB9dA9f4D39E737863ea`; transaction [0xf16224…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xf1622496eb647b47c1d6282883a31e695fb4777c8a9d6376f43777fa12676985) succeeded in block 12488313; deployed code verified. |
| Elysium test assets | VERIFIED ON TESTNET | Test-only mock USDC `0x1c615884174973eb69c14ebb3c9a91d72f2d035d`, creator token 1 `0x2358d9a7d7a5000914bca4c20d193039d788cf8f`, and creator token 2 `0xa386e1d7ca484a2cc8a83ea7d1721924e50d21ca`; these are not production or verified Ascend assets. |
| Vercel frontend deployment | PARTIAL | Production deployment [dpl_5nNkEQdMGRKxD8s2tMRYC5xii67g](https://vercel.com/delealufejoel-4184s-projects/loydura/5nNkEQdMGRKxD8s2tMRYC5xii67g) is READY at [loydura.vercel.app](https://loydura.vercel.app); Worker rewrite and production-cookie evidence remain pending. |
| Cloudflare Worker deployment | NOT DEPLOYED / UNKNOWN | URL, /health output, Supabase/R2/RPC checks required. |
| Browser SIWE and production cookies | NOT VERIFIED | Requires deployed frontend and Worker. |
| Full membership/campaign lifecycle | NOT VERIFIED | Requires funded testnet wallets and receipt evidence. |
| Local Wrangler development | VERIFIED LOCALLY | Wrangler served `/health` with an expected 503 degraded response when secrets/contracts were absent and rejected a hostile origin with 403. |
| CI | VERIFIED REMOTELY | GitHub Actions run [39520059448](https://github.com/ometere123/loydura/actions/runs/39520059448) passed contracts, Worker, and web jobs, including the frontend Playwright suite. |
| Ascend submission | NOT CLAIMED | No partnership, token launch, audit, or competition acceptance is inferred. |

## Blockers

Remaining release gates are the modern Supabase `sb_secret_…` credential and migration/RLS verification, Worker deployment and health/R2 integration, Vercel-to-Worker rewrite and production-cookie checks, and the complete live membership/campaign/browser lifecycle suite.

