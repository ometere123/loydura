# Loydura architecture

## Runtime boundaries

| Boundary | Responsibility |
|---|---|
| Vercel / `apps/web` | Next.js pages, premium design system, wallet connection, wallet-signed contract transactions, and same-origin browser calls to `/api/*` |
| Cloudflare Worker / `apps/worker` | Hono API, EIP-4361 verification, Web Crypto sessions, origin/CSRF checks, rate limits, Supabase operations, R2 operations, and live Elysium reads |
| Supabase PostgreSQL | Nonces, hashed sessions, shop profiles, content metadata, and atomic rate-limit buckets through security-definer RPCs |
| Cloudflare R2 | Private file bytes through the native `LOYDURA_R2` binding; no public objects or browser credentials |
| Elysium Testnet 99801 | Contract ownership, membership expiry, payment settlement, token custody, reward accounting, and principal/reward settlement |

Vercel's external rewrite is a routing proxy only. No Next.js API route, Server Action, or Vercel Function contains backend business logic.

## Product routes

- `/` is a service-independent marketing homepage; it does not require Worker, Supabase, or RPC availability.
- `/discover` reads directory metadata through the Worker and campaign facts from live contracts, with bounded loading and explicit error states.
- `/shop/[id]` combines on-chain membership facts, checkout, protected content, linked campaigns, provenance labels, and transparency links.
- `/campaign/[id]` displays live reward accounting, position state, early-exit forfeiture, claimability, principal recovery, and creator-refund state.
- `/studio` discovers creator-owned shops from bounded `ShopCreated` events and verifies current on-chain ownership before showing management controls.
- `/me` discovers wallet activity from bounded, overlap-aware events and refreshes current contract state; it does not require manual shop or campaign IDs.

## Contracts

- `LoyduraHub.sol` provides immutable creator shops, up to five fixed payout recipients, 30-day membership renewal, and exact ERC-20 balance-delta checks.
- `LoyduraRewards.sol` provides fully funded USDC campaigns, pre-start membership-gated locks, O(1) reward accounting, early-exit forfeiture redistribution, end-of-campaign claims, and constrained creator refunds.
- `MockToken.sol` is a labeled testnet fixture only.

Financial settlement, custody, reward calculation, and principal withdrawal remain in Solidity. The Worker never moves those responsibilities into Supabase or its own storage.

## API authorization model

Mutations require the exact configured `APP_ORIGIN` in `Origin`. Production sessions use HttpOnly, Secure, SameSite=Lax cookies, while local development uses the same model without Secure on HTTP. SIWE nonces are short-lived, wallet/chain-bound, and consumed atomically by Supabase. Sessions store only SHA-256 hashes of random tokens and expire after 24 hours.

The Worker reads the live Hub contract before creator mutations or protected-content access. A database creator field, client-supplied balance, client-supplied membership flag, or stale metadata row is never authoritative. Member access is checked against the current on-chain membership expiry using the latest Elysium block timestamp on every protected request.

## Private content

Text posts are metadata rows in Supabase. Files are validated by MIME and magic bytes, limited to 12 MiB, stored under a non-guessable R2 key, and streamed only after session plus live membership/creator authorization. Downloads use `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and a sanitized attachment filename.
