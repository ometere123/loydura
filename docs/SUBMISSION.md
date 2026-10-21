# Ascend submission record

## Product

Loydura gives Elysium creators a useful commerce loop: token-priced 30-day memberships, protected member content, and creator-funded USDC commitment campaigns with transparent forfeiture, reward, and principal rules. The five approved product screens are Discover, Creator Store, Campaign, Creator Studio, and My Dashboard, with a dedicated public homepage explaining the product and risks.

## Why it matters

Launching a token does not automatically create customer activity. Loydura gives creators a real membership product, a place to deliver value, and a funded commitment campaign whose rules are visible before signing. Members can discover actual products, purchase access, consume protected content, and understand the difference between accrued rewards, claimable rewards, and recoverable principal.

## Execution evidence

- Source commit: `4f13f91795a2fe767dbd5277ee39b24d9d416547`.
- Frontend: [loydura.vercel.app](https://loydura.vercel.app).
- Worker: [loydura-api.delealufejoel.workers.dev](https://loydura-api.delealufejoel.workers.dev).
- Contracts: Hub `0x12B48836E495F863F40212f40aEc7372388345a4`; Rewards `0x3aaE1d1f9E751996aA3CaB9dA9f4D39E737863ea`.
- CI: [run 39540235093](https://github.com/ometere123/loydura/actions/runs/39540235093).
- Post-redesign testnet lifecycle: campaign #2 completed with four memberships, four locks, two early exits, two claims, principal recovery, and creator reclaim; transaction evidence is in [TESTNET_EVIDENCE.md](TESTNET_EVIDENCE.md).
- Full source, lifecycle, storage, and test evidence: [TESTNET_EVIDENCE.md](TESTNET_EVIDENCE.md).

## Competition copy

### Short description

Loydura turns token launches into useful creator commerce: memberships, protected content, and transparent USDC commitment campaigns on Elysium.

### Demo script

1. Open the homepage and explain the utility gap: a token needs a reason to be used after launch day.
2. Move to Discover and show a real storefront and campaign facts read from the Worker and Elysium.
3. Open a storefront to show the token price, access duration, payment transparency, and member-only content boundary.
4. Open Creator Studio to show automatic wallet-owned storefront discovery, protected publishing, and the campaign funding workflow.
5. Open a campaign to explain the funded pool, start/end dates, early-exit forfeiture, reward claim, and principal recovery as separate states.
6. Finish in My Dashboard with wallet-specific memberships and commitments.

### Long-term vision

Loydura is a utility layer for creator economies that value durable participation over launch-day speculation. The next growth of the product should come from better creator products and verifiable customer value, not promises of token-price performance.

## Claims boundary

Loydura does not claim official Ascend sponsorship, certification, independent audit, revenue, user traction, or an Ascend token launch. Creator-submitted launch URLs are labeled as claims, while Elysium contract ownership and settlement remain independently readable. No mainnet token launch or real-money action was performed.

## Readiness verdict

The testnet application is materially implemented, source-verified, deployed, and supported by green local/CI gates. The post-redesign campaign-#2 lifecycle has now been replayed on Elysium with real memberships, locks, early exits, claims, principal recovery, and creator reclaim. It remains short of an unqualified READY declaration because interactive browser-wallet signing was not automated in the final browser suite and the dependency audit findings remain documented residual risk.
