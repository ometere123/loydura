# Security model and release gates

This repository must not be described as audited or production-ready without matching evidence. Testnet fixture tokens have no value.

## Authentication

- SIWE follows EIP-4361, chain ID 99801, exact frontend domain/origin, short expiry, and a single-use Supabase nonce.
- The Worker verifies the wallet signature server-side, stores only a SHA-256 session-token hash, and expires sessions after 24 hours.
- Mutating browser requests require the exact Origin allowlist entry. SameSite cookies, origin checks, and replay-safe nonces provide CSRF/replay defenses.
- Sensitive endpoints use Supabase-backed atomic rate-limit buckets keyed by a hash of the client IP and operation.

## Authorization

The Worker resolves the on-chain shop owner and membership expiry on every sensitive operation. Client fields and stale database identity fields cannot grant creator or member access. Content is isolated by shop, creator mutations require current on-chain ownership, and expired membership cannot download protected content.

## Storage

R2 remains private and is accessed only through the native LOYDURA_R2 binding. Files are limited to 12 MiB, allowlisted by MIME and magic bytes, stored with generated keys, and streamed with no-store and sanitized Content-Disposition. HTML/active content is not an approved upload type.

## Contract risks

The Solidity tests cover unauthorized actions, timing, reward conservation, claim/exit ordering, fee accounting, and adversarial sender-tax transfer behavior. OpenZeppelin SafeERC20 and ReentrancyGuard are used, but hostile rebasing, blacklisting, callback, and arbitrary-token behavior still require independent review and allowlisting before non-testnet use.

## Mandatory evidence before release

Run and retain results for contract fuzz/invariant tests, Worker unit/integration tests, Supabase migration/RLS checks, R2 authorization checks, origin/CSRF/replay/expiry checks, Vercel rewrite tests, browser cookie tests, live Elysium membership/campaign flows, and production health verification. Missing external credentials or deployment proof is a blocker, not a pass.

