# Loydura architecture

## Runtime boundaries

| Boundary | Responsibility |
|---|---|
| Vercel / apps/web | Next.js pages, CSS, wallet connection, wallet-signed contract transactions, same-origin browser calls to /api/* |
| Cloudflare Worker / apps/worker | Hono API, EIP-4361 verification, Web Crypto sessions, CSRF/origin checks, rate limits, Supabase operations, R2 operations, live Elysium reads |
| Supabase | PostgreSQL tables and security-definer RPCs for nonces, hashed sessions, profiles, content metadata, and rate limits |
| Cloudflare R2 | Private file bytes through native LOYDURA_R2 binding; no public objects or browser credentials |
| Elysium 99801 | Contract ownership, membership expiry, payment settlement, token custody, reward accounting |

Vercel's rewrite is a transport proxy. It is not an authorization layer and does not contain backend business logic.

## Contracts

- LoyduraHub.sol: immutable creator shops, up to five fixed payout recipients, 30-day membership renewal, and exact ERC-20 balance-delta checks.
- LoyduraRewards.sol: fully funded USDC campaigns, pre-start membership-gated locks, O(1) reward accounting, early-exit forfeiture redistribution, end-of-campaign claims, and constrained creator refunds.
- MockToken.sol: testnet fixture only.

Financial settlement, custody, reward calculation, and principal withdrawal remain in Solidity. The Worker never moves those responsibilities into Supabase or its own storage.

## API authorization model

All mutations require the exact configured APP_ORIGIN in Origin, and browser sessions use HttpOnly, SameSite=Lax, and Secure cookies on HTTPS. SIWE nonces are short-lived, wallet/chain-bound, and consumed atomically by Supabase. Sessions store only SHA-256 hashes of random tokens.

The Worker reads the live Hub contract before creator mutations or protected-content access. A database creator_address, client-supplied balance, or client-supplied membership flag is never authoritative. Member access is checked against the current on-chain membership expiry on every protected request.

## Private content

Text posts are metadata rows in Supabase. Files are validated by MIME and magic bytes, limited to 12 MiB, stored under a non-guessable R2 key, and streamed only after session plus live membership/creator authorization. Downloads use Cache-Control: no-store, nosniff, and a sanitized attachment filename.

