# Security model and release gates

Loydura is a testnet release candidate, not an independently audited mainnet protocol. Testnet fixture tokens have no monetary value. The evidence ledger is the authority for what was actually verified.

## Authentication and browser boundaries

- SIWE follows EIP-4361 with Elysium chain ID 99801, exact frontend domain/URI validation, short expiry, and a single-use Supabase nonce.
- The Worker verifies signatures server-side, stores only a SHA-256 session-token hash, expires sessions after 24 hours, and clears sessions on logout or wallet changes.
- Production cookies are HttpOnly, Secure, SameSite=Lax, and same-origin through the Vercel rewrite. Mutating browser requests require the configured `APP_ORIGIN`; missing or hostile Origins are rejected.
- Sensitive endpoints use Supabase-backed atomic rate-limit buckets keyed by a hash of the client IP and operation.
- The frontend constructs the SIWE message with actual newline characters. A pure regression test prevents literal `\\n` sequences from returning.

## Authorization and storage

The Worker resolves the on-chain shop owner and membership expiry for every sensitive operation. Client fields and stale database identity cannot grant creator or member access. Content is isolated by shop, creator mutations require current on-chain ownership, and expired membership cannot download protected content.

R2 remains private and is accessed only through the native `LOYDURA_R2` binding. Files are limited to 12 MiB, allowlisted by MIME and magic bytes, stored with generated keys, and streamed with no-store and sanitized `Content-Disposition`. HTML/active content is not an approved upload type.

## Contract review

Foundry coverage includes unauthorized actions, timing, reward conservation, claim/exit ordering, fee accounting, sender-tax and fee-on-transfer rejection, multi-campaign isolation, repeated action boundaries, and 512-run fuzz tests. `contracts/test/LoyduraReferenceModel.t.sol` provides an independent settlement model for adversarial two-member early exits and compares principal/reward conservation with the Solidity implementation.

OpenZeppelin `SafeERC20` and `ReentrancyGuard` are used. Hostile rebasing, blacklisting, callbacks, and arbitrary-token behavior remain testnet limitations; production use would require explicit token allowlisting and a separate audit.

## Residual release limitations

- The final Playwright run does not automate a browser wallet-extension signature prompt; production API signing, cookie behavior, replay rejection, and the SIWE newline regression are verified.
- The real five-wallet testnet lifecycle ledger is retained from the unchanged deployed contracts and was not replayed after the UI-only redesign.
- The dependency graph now reports 26 audit findings (24 moderate, 2 high, 0 critical) after removing the unused `eslint-config-next` package. The remaining high findings are transitive PostCSS and WalletConnect/wagmi paths; available automated fixes require major Next or wagmi migrations and were not applied without full compatibility validation. No independent audit or mainnet readiness claim is made.
