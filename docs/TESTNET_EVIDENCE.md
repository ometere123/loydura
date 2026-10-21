# Testnet evidence ledger

This file records observed evidence only. Unknown values remain blockers.

| Gate | Status | Evidence |
|---|---|---|
| Solidity compile | VERIFIED LOCALLY | Foundry build passed after pinned OpenZeppelin 5.2.0 and forge-std 1.9.7 installation. |
| Solidity test suite | VERIFIED LOCALLY | 19 tests passed; invariant/fuzz depth and external live lifecycle still require separate evidence. |
| Worker typecheck/build | VERIFIED LOCALLY AND ON CLOUDFLARE | Worker typecheck/lint/build passed, the production deployment started successfully, and the native `LOYDURA_R2` binding is attached to `loydura-private`. |
| Worker security/integration tests | VERIFIED WITH LIVE COVERAGE | Six Worker tests pass. Live production checks cover SIWE login/logout/replay, origin rejection, creator authorization, on-chain membership denial, R2 upload/download/delete, the exact 12 MiB upload boundary, and protected-response cache headers. |
| Frontend typecheck/lint/build | VERIFIED LOCALLY | Frontend typecheck, source-scoped lint, and Next production build passed. Build emitted only optional wallet-library and CSS warnings. |
| Supabase migration/RLS | VERIFIED ON PROJECT | Migration `0001_initial.sql` was applied to project `pzkjjwjrhktkmkpgvmlb`; RLS is enabled with no browser policies, service-role table grants are explicit, REST table checks return 200, and the live SIWE replay test exercised atomic nonce consumption and rate-limit RPCs. |
| Private R2 upload/download | VERIFIED ON TESTNET | Private bucket `loydura-private` is bound natively as `LOYDURA_R2`. A text file and an exact 12 MiB text file uploaded through the Vercel rewrite, downloaded with `Cache-Control: no-store` and a safe attachment filename, and were deleted successfully; unauthorized and post-delete reads were rejected. |
| Elysium deployer funding | VERIFIED ON TESTNET | Bridge transaction [0xc62f7b…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xc62f7bff5ab316f7ba1b98577b6857874aa1ae7e6bdbe2953214604feadc81c3) succeeded and credited 0.1 native HYPE to the configured deployer on chain 99801. |
| Elysium Hub deployment | VERIFIED ON TESTNET | `0x12B48836E495F863F40212f40aEc7372388345a4`; transaction [0xb31ed7…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xb31ed795f2ff82c5e4cb5a253eebb6bfa3dfeaaa9f1b9f6c87f865421b91f72a) succeeded in block 12488301; deployed code verified. |
| Elysium Rewards deployment | VERIFIED ON TESTNET | `0x3aaE1d1f9E751996aA3CaB9dA9f4D39E737863ea`; transaction [0xf16224…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xf1622496eb647b47c1d6282883a31e695fb4777c8a9d6376f43777fa12676985) succeeded in block 12488313; deployed code verified. |
| Elysium test assets | VERIFIED ON TESTNET | Test-only mock USDC `0x1c615884174973eb69c14ebb3c9a91d72f2d035d`, creator token 1 `0x2358d9a7d7a5000914bca4c20d193039d788cf8f`, and creator token 2 `0xa386e1d7ca484a2cc8a83ea7d1721924e50d21ca`; these are not production or verified Ascend assets. |
| Vercel frontend deployment | VERIFIED ON PRODUCTION | Latest production deployment [dpl_2WJQR9nN5VVipPxnRmnA9s5CfpAM](https://vercel.com/delealufejoel-4184s-projects/loydura/2WJQR9nN5VVipPxnRmnA9s5CfpAM) is READY at [loydura.vercel.app](https://loydura.vercel.app). The browser renders live shop #1 and campaign #1 from Elysium through the corrected public configuration. |
| Cloudflare Worker deployment | VERIFIED ON PRODUCTION | [loydura-api.delealufejoel.workers.dev](https://loydura-api.delealufejoel.workers.dev) version `a7e8c952-5785-4b7c-8c34-ad6e51562432` returns `/health` 200 with `config`, `database`, `r2`, `rpc`, and `contracts` all true. Hostile and missing origins return 403. |
| Browser SIWE and production cookies | VERIFIED THROUGH PRODUCTION API; BROWSER WALLET SIGNING PARTIAL | Vercel-to-Worker SIWE created a Secure, HttpOnly, SameSite=Lax cookie; session validation, logout, and replay rejection passed through `/api/*`. CUA browser smoke checks passed for Discover, Creator Store, Campaign, Creator Studio, and My Dashboard; an interactive wallet-signature prompt was not automated. |
| Full membership/campaign lifecycle | VERIFIED ON TESTNET | Shop #1 and campaign #1 were exercised with one creator and four member wallets: all memberships purchased, four locks admitted, two early exits forfeited rewards, two members claimed after completion, all principal was returned, and the creator reclaimed the remaining 9 micro-USDC. |
| Local Wrangler development | VERIFIED LOCALLY | Wrangler served `/health` with an expected 503 degraded response when secrets/contracts were absent and rejected a hostile origin with 403. |
| CI | VERIFIED REMOTELY; FINAL COMMIT PENDING | GitHub Actions run [39520738080](https://github.com/ometere123/loydura/actions/runs/39520738080) is the latest pre-freeze evidence. A new run must pass after the final source/documentation commit. |
| Ascend submission | NOT CLAIMED | No partnership, token launch, audit, or competition acceptance is inferred. |

## Blockers

Remaining release gates are final-commit CI, independent source verification of the deployed contracts on the explorer, and an interactive wallet-signature Playwright run. No mainnet deployment, real-money launch, Ascend approval, or production-token provenance is claimed.

## Live contract and lifecycle evidence

- Hub: `0x12B48836E495F863F40212f40aEc7372388345a4`; Rewards: `0x3aaE1d1f9E751996aA3CaB9dA9f4D39E737863ea`; test USDC: `0x1c615884174973eb69c14ebb3c9a91d72f2d035d`; test creator token: `0x2358d9a7d7a5000914bca4c20d193039d788cf8f`.
- Shop #1 creation: [0x388df0…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x388df0da0ba46f2e7b6ccb054c5cc45e43d9e497b50725e51316294eed69216c).
- Campaign #1 creation: [0xd8d3c9…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xd8d3c9e49a8171ec7e2a10f4ddd8a985f52a78db023daae88f3ae7f36184fda6).
- Early exits: [0xd5a523…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xd5a523b002d3b1620cf962c848a5fa616d069a6b5e25839cef6aab1e7713e5e3) and [0xce5791…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xce579105ecc139b03c757f108d733823ce217600f3f378ff357bf5d34a5c2525).
- Completed claims: [0xcda328…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xcda328447a942512efef9239bd1144a9123035138dc9eb7e5ceef7d9ecd33a09) and [0x3c9f85…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x3c9f8538317f9ef5a474ef75b51164e6c42adc096ac9a0a80f623e46f1e528ba).
- Principal withdrawals: [0xee9cb9…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xee9cb92d4f5d3a427ad787d5eb553200006b86f66a3ccea6cef41733d85356db) and [0x6bfb65…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x6bfb6523d635a4671ceb92492e8707e0879d956ff17c77ac6f059a9a45cc09d7).
- Creator residual reclaim: [0x00d6ab…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x00d6ab7af8b3b395df632b796f429663c6af58a43e27cc49b8f8aeee2acdb2b2).
- Final campaign state: budget `120007`, claimed `119998`, refunded `9`, total forfeited `32166` micro-USDC; `2` early exits, `2` completed positions, `0` pending claims, `0` active lockers, and `0` active stake.

