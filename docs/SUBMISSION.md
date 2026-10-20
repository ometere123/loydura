# Ascend submission record

## Product

Loydura is one Elysium Testnet product: token-powered 30-day creator memberships, private member content, and creator-funded USDC commitment campaigns. The five approved screens are Discover, Creator Store, Campaign, Creator Studio, and My Dashboard.

## Architecture

Vercel hosts the Next.js client. Cloudflare Workers owns the full backend API, SIWE sessions, authorization, Supabase access, live chain checks, and private R2 streaming. Supabase is PostgreSQL metadata/session storage. R2 is private. Solidity contracts retain membership settlement, token custody, reward accounting, and withdrawals.

## Evidence policy

Do not submit placeholder contract addresses, deployment URLs, transaction hashes, CI runs, audit claims, partnership claims, or token-launch claims. Fill the release facts from observed evidence in docs/TESTNET_EVIDENCE.md only after the complete contract, Worker, Supabase, frontend, Playwright, browser, and deployment checks pass.

## Current status

The repository contains the architecture migration and local Solidity verification. External Supabase, Cloudflare, Vercel, GitHub, and Elysium deployment evidence remains a release gate until recorded.

