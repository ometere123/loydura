# Loydura frontend design and usability

## Product structure

Loydura separates explanation from exploration. The root route is a public, service-independent marketing homepage; `/discover` is the live directory; `/shop/[id]` is the creator storefront; `/campaign/[id]` is the contract-backed commitment view; `/studio` is the authenticated creator workspace; and `/me` is the wallet activity dashboard.

The primary navigation is deliberately short: Home, Discover, Creator Studio, My Dashboard, and Connect Wallet. The wordmark always returns to `/`, and mobile navigation uses the same destinations in a keyboard-accessible drawer.

## Visual system

The design language uses an obsidian and forest base, warm ivory typography, lime interaction accents, and restrained gold for funded financial values. Surfaces are layered by elevation rather than repeating identical bordered cards. Editorial page introductions establish context first, followed by live metrics, decision panels, and explicit next actions.

Reusable primitives in `apps/web/components/design-system.tsx` cover page introductions, section headings, metrics, status badges, verified labels, loading states, empty states, error/retry states, configuration notices, address values, transaction links, and onboarding steps. Global tokens and responsive layout rules live in `apps/web/app/globals.css`.

## Interaction principles

- Live contract facts are labeled and separated from creator-submitted metadata.
- A failed directory or RPC request is shown as an error, never as proof that no data exists.
- Wallet-gated controls explain the next step before presenting forms.
- Transaction actions show exact approval amounts, receipt waiting, explorer links, reverts, and refresh behavior.
- Campaign pages distinguish accrued estimates, claimable rewards, principal withdrawal, early exit, and creator-refundable balances.
- Creator Studio discovers owned shops from bounded on-chain events and rechecks current ownership; routine management does not require manual shop IDs.
- My Dashboard discovers wallet activity from bounded, overlap-aware event reads and refreshes current contract state before presenting eligibility.
- The homepage remains complete when Worker, Supabase, and RPC services are unavailable.

## Responsive and accessibility behavior

The interface is tested at 375px, 768px, 1440px, and 1920px widths. Grids collapse to readable single-column flows on small screens, navigation becomes a labeled mobile menu, buttons and inputs retain visible focus styles, and reduced-motion preferences disable decorative transitions. Long addresses and transaction text use wrapping or shortened labels with full values available via title/explorer links.

## Benchmark lessons

The source audit of OriginGuard, Calivryn, and Jestor informed the work without copying their designs: OriginGuard's role-oriented information hierarchy and explicit operational states, Calivryn's guided contextual workspace composition, and Jestor's confident brand voice and tactile navigation were adapted into Loydura's own commerce-and-commitment system.

## Evidence boundary

Screens and states that represent live stores, campaigns, balances, memberships, or content are backed by Worker responses and Elysium reads. The homepage's product visualization is illustrative and intentionally contains no fabricated usage metrics, testimonials, partnerships, or financial promises.
