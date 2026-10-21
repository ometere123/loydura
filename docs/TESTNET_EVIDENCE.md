# Testnet evidence ledger

This ledger records observed evidence for the application runtime commit `ed8208c7e30e1ba7fd3240d9942425f37b65faea` on 2026-10-21. The application implementation and post-redesign lifecycle were previously verified in `4f13f91795a2fe767dbd5277ee39b24d9d416547`; the release baseline upgrades Next.js to 16.4.2, refreshes the dependency baseline, and records source-matched production evidence. Documentation-only follow-ups do not change application bytes. Testnet assets have no monetary value. Unknown or partially automated gates remain explicitly labeled.

| Gate | Status | Evidence |
|---|---|---|
| Solidity compilation | VERIFIED LOCALLY and in CI | Foundry compilation passed with Solidity 0.8.24, OpenZeppelin 5.2.0, and forge-std 1.9.7. |
| Solidity tests | VERIFIED LOCALLY and in CI | `npm run test:contracts`: 20 tests passed, 0 failed. The original 19 tests remain green; the independent reference-model fuzz test runs 512 cases, and the existing conservation fuzz tests run 512 cases each. |
| Worker checks | VERIFIED LOCALLY and in CI | Worker typecheck, lint, and six Vitest security tests passed. |
| Frontend checks | VERIFIED LOCALLY and in CI | Web typecheck, lint, Next.js 16.4.2 production build with explicit Webpack mode, and Playwright all passed. Playwright: 6 tests passed, including the SIWE newline regression and responsive checks at 375, 768, 1440, and 1920 pixels. |
| Supabase migration/RLS | VERIFIED ON EXISTING PROJECT | `supabase/migrations/0001_initial.sql` is the applied foundation. Production Worker health confirms database connectivity; nonce consumption and rate-limit RPCs remain atomic security-definer paths, with browser table access closed by RLS. |
| Private R2 | VERIFIED ON PRODUCTION WORKER | Native `LOYDURA_R2` is bound to private bucket `loydura-private`. The existing live evidence covered text and exact 12 MiB uploads, authenticated streaming, no-store responses, safe filenames, unauthorized denial, and cleanup. Production health reports `r2: true`. |
| Contract source verification | VERIFIED ON EXPLORER | [LoyduraHub source](https://elysium.kinetiq.xyz/testnet-explorer/address/0x12B48836E495F863F40212f40aEc7372388345a4?tab=contract) and [LoyduraRewards source](https://elysium.kinetiq.xyz/testnet-explorer/address/0x3aaE1d1f9E751996aA3CaB9dA9f4D39E737863ea?tab=contract) show fully verified Solidity source, compiler 0.8.24, Paris EVM target, and 200 optimizer runs. |
| Elysium deployments | VERIFIED ON TESTNET | Hub `0x12B48836E495F863F40212f40aEc7372388345a4`; Rewards `0x3aaE1d1f9E751996aA3CaB9dA9f4D39E737863ea`; mock USDC `0x1c615884174973eb69c14ebb3c9a91d72f2d035d`. Deployed bytecode and constructor state were independently read before configuration. |
| Elysium funding | VERIFIED ON TESTNET | Bridge transaction [0xc62f7b…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xc62f7bff5ab316f7ba1b98577b6857874aa1ae7e6bdbe2953214604feadc81c3) succeeded and funded the deployer with testnet HYPE. |
| Cloudflare Worker deployment | VERIFIED ON PRODUCTION | Worker URL: [loydura-api.delealufejoel.workers.dev](https://loydura-api.delealufejoel.workers.dev). Current version `3d9c7667-62e1-4b32-a767-f4db3194c13f`. `/health` returned 200 with `config`, `database`, `r2`, `rpc`, and `contracts` all true. `/api/shop` returned one real profile; anonymous `/api/auth/session` returned unauthenticated; hostile-origin logout returned 403. |
| Vercel deployment | VERIFIED ON PRODUCTION | Deployment [dpl_A1E9hLpufaw9uWnBTJcdygcFCoit](https://vercel.com/delealufejoel-4184s-projects/loydura/A1E9hLpufaw9uWnBTJcdygcFCoit) is READY, built with Next.js 16.4.2 from the clean runtime checkout at `ed8208c7e30e1ba7fd3240d9942425f37b65faea`, and aliased to [loydura.vercel.app](https://loydura.vercel.app). Vercel rewrite checks through `/api/*` returned the real shop directory, unauthenticated session state, and 403 for a hostile Origin. |
| Anonymous public access | VERIFIED IN FRESH ANONYMOUS BROWSER | A fresh in-app browser context with no owner session rendered the current production homepage and Discover route; HTTP checks returned 200 for `/`, `/discover`, `/studio`, `/me`, `/shop/1`, and `/campaign/1`. No Vercel SSO wall was observed; Connect Wallet was available and Sign in remained disabled until a wallet was connected. |
| Production SIWE | VERIFIED THROUGH PRODUCTION API; BROWSER WALLET PROMPT PARTIAL | A fresh signed EIP-4361 request through the current Vercel rewrite returned nonce 200, verify 200, authenticated session 200, replay 401, and logout 200 for the real Elysium deployer wallet. The response cookie was verified as Secure/HttpOnly/SameSite=Lax with Max-Age=86400, and the message contained real newline characters. The client message builder has a six-test Playwright regression guard. An interactive wallet-extension signature prompt was not automated in this run. |
| Full live membership/campaign ledger | VERIFIED ON TESTNET AFTER UI REDESIGN | `contracts/script/TestnetLifecycle.ps1` ran a fresh campaign #2 against the unchanged deployments using four ephemeral member wallets: four memberships, four locks, two early exits, two completed claims, two principal withdrawals, and creator residual reclaim. Final campaign state was budget `120000`, claimed `119878`, refunded `122` micro-USDC, total forfeited `3384`, `0` active lockers, `2` completed, and `0` pending claims. This is real chain evidence; it is not a Playwright wallet-prompt test. |
| Local Wrangler development | VERIFIED LOCALLY | Wrangler configuration points local frontend rewrites at `127.0.0.1:8787`; missing-secret health returns degraded 503 and hostile origins return 403. |
| CI | VERIFIED ON RUNTIME COMMIT | [GitHub Actions run 39552714904](https://github.com/ometere123/loydura/actions/runs/39552714904) passed Worker, web, Playwright, and contracts jobs for commit `ed8208c7e30e1ba7fd3240d9942425f37b65faea`. |
| Production screenshots | VERIFIED FROM LIVE DEPLOYMENT | Refreshed with `apps/web/scripts/capture-release-screenshots.mjs` against the current `https://loydura.vercel.app` deployment after the Next.js upgrade, including the previous deployment for the before/after comparison. |
| Ascend relationship | NOT CLAIMED | Creator-submitted launch URLs remain labeled as provenance claims. No official sponsorship, certification, approval, audit, token launch, traction, or endorsement is inferred. |

## Contracts and lifecycle references

- Hub deployment: [0xb31ed7…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xb31ed795f2ff82c5e4cb5a253eebb6bfa3dfeaaa9f1b9f6c87f865421b91f72a).
- Rewards deployment: [0xf16224…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xf1622496eb647b47c1d6282883a31e695fb4777c8a9d6376f43777fa12676985).
- Shop #1 creation: [0x388df0…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x388df0da0ba46f2e7b6ccb054c5cc45e43d9e497b50725e51316294eed69216c).
- Campaign #1 creation: [0xd8d3c9…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xd8d3c9e49a8171ec7e2a10f4ddd8a985f52a78db023daae88f3ae7f36184fda6).
- Early exits: [0xd5a523…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xd5a523b002d3b1620cf962c848a5fa616d069a6b5e25839cef6aab1e7713e5e3) and [0xce5791…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xce579105ecc139b03c757f108d733823ce217600f3f378ff357bf5d34a5c2525).
- Completed claims: [0xcda328…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xcda328447a942512efef9239bd1144a9123035138dc9eb7e5ceef7d9ecd33a09) and [0x3c9f85…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x3c9f8538317f9ef5a474ef75b51164e6c42adc096ac9a0a80f623e46f1e528ba).
- Principal withdrawals: [0xee9cb9…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xee9cb92d4f5d3a427ad787d5eb553200006b86f66a3ccea6cef41733d85356db) and [0x6bfb65…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x6bfb6523d635a4671ceb92492e8707e0879d956ff17c77ac6f059a9a45cc09d7).
- Creator residual reclaim: [0x00d6ab…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x00d6ab7af8b3b395df632b796f429663c6af58a43e27cc49b8f8aeee2acdb2b2).
- Final recorded campaign state: budget `120007`, claimed `119998`, refunded `9` micro-USDC; `2` early exits, `2` completed positions, `0` pending claims, and `0` active lockers.

### Post-redesign campaign #2 lifecycle

- Ephemeral members: `0x15331BFc8672Cd4734a85eD05F9985f560BE4c03`, `0xb105Df0887C20A5F665D0aEAfdD8c32151Ad2dd0`, `0x8431F014FEeB948c064b43057E9D276560FF756A`, and `0xB92A5B05C5d15c25fba2F840D70E54cAe435Fd06`.
- Campaign creation: [0xc841c7…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xc841c7f93cceffb3d3819d53b4a736853e9edfdb54cf55a29dfeefe1ba839182).
- Membership purchases: [0x99d460…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x99d4606b2cc966b1a339c4d45c74b4116a56905533891ce0d2d50fd36bd00879), [0x311050…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x3110503a160a2cb570e22eeef72bba131ece7c85be0c58b4373d52abc802daa9), [0xc631f3…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xc631f361a70e0a4b966649b77506f116074e8d129c87137fc8bc614f4b0e484e), and [0x90531c…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x90531cc9577e6d3991ab5683a9f36cfdf7c9e2977a093cb4bd0a598c3ba3fb4a).
- Locks: [0x20ba2a…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x20ba2a51c2872cd82947f4a4941edf6c61f1fbb071028f654c8f6a4e5917879c), [0xdd75c1…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xdd75c1eca8d68a3ba1138ec52bf4f9830dc2f537564f04bacffdd8acef454145), [0xaad600…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xaad60071d107173036ee5b15ef746ad29631c457e09dc601dc54caa59b89acd9), and [0xf3d8ee…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xf3d8ee929d3fc6efecc770a909615bd03b572da79ade9421aeb768f8584e6145).
- Early exits: [0x78872e…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x78872e9b934927cb1458d8e0007101ceddef072c16bbda6cef560e21a24ac4f5) and [0x57b4c3…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x57b4c3ef33eedf52d9cc3465c3352ea6c9443c44b3ed1f83b3d9023e32cdc10e).
- Completed claims: [0x6cd2de…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x6cd2de566220d961a93c395713b8692c1cffb0240e7770b15f188fbfe6769864) and [0xca1663…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xca1663ecb8108e32e49aebbe47cf7a533aeb88589294e590c94cfd79c4a7013c).
- Principal withdrawals: [0xf284e7…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xf284e7d0e93da8ebf6fb782d56a6f57bd832d97dda116be66c194cd25ca12a9c) and [0x3a2b71…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0x3a2b71fe8274bd491fdd0a7d19233682a98a4ecc3d84dc7b25dd495ad9297ca3).
- Creator residual reclaim: [0xfb4f8d…](https://elysium.kinetiq.xyz/testnet-explorer/transaction/0xfb4f8d3211ab15a32e1e6a0b98220e77fdb5919830f27bb0a512d06261bc5f9a).

## Browser screenshot evidence

The release screenshot set is stored under `docs/evidence/screenshots/`:

- `before-home-1440.png` — previous deployed homepage.
- `after-home-1440.png` and `after-home-375.png` — redesigned desktop and mobile homepage.
- `after-discover-1440.png`, `after-studio-1440.png`, `after-dashboard-1440.png` — principal workspace routes.
- `after-shop-1-1440.png` and `after-campaign-1-1440.png` — live storefront and campaign routes.

These are captures of the real production deployment, not static mockups.

## Remaining release limitations

1. A browser-wallet extension signature prompt was not automated in the final Playwright run. The production API SIWE path and the client newline regression are verified; a human wallet prompt remains a manual acceptance step.
2. The dependency graph reports 24 audit findings (23 moderate, 1 high, 0 critical). Next.js was upgraded to 16.4.2 with explicit Webpack build/dev compatibility, removing the PostCSS high finding. The remaining high finding is the transitive WalletConnect/wagmi `ws` path; the available automated fix requires a major wagmi migration that is incompatible with the pinned RainbowKit peer range. No independent audit or mainnet readiness claim is made.
