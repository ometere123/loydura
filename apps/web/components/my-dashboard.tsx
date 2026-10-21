"use client";

import Link from "next/link";
import { Activity, Clock3, Coins, ExternalLink, RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { formatUnits, parseAbiItem, type AbiEvent, type Address, type PublicClient } from "viem";
import { addresses, erc20Abi, hubAbi, isAddress, isPublicChainReady, publicConfig, rewardsAbi } from "@loydura/chain";
import { ChainConfigNotice, EmptyState, ErrorState, LoadingState, MetricCard, PageIntro, SectionHeading, StatusBadge, VerifiedLabel } from "@/components/design-system";

const membershipEvent = parseAbiItem("event MembershipPurchased(uint256 indexed shopId, address indexed buyer, uint64 expiresAt, uint256 grossAmount, uint256 fee)");
const lockedEvent = parseAbiItem("event Locked(uint256 indexed campaignId, address indexed member, uint256 amount)");
const unlockedEvent = parseAbiItem("event Unlocked(uint256 indexed campaignId, address indexed member, uint256 amount, bool early, uint256 forfeited)");
const rewardClaimedEvent = parseAbiItem("event RewardClaimed(uint256 indexed campaignId, address indexed member, uint256 amount)");
const campaignCreatedEvent = parseAbiItem("event CampaignCreated(uint256 indexed campaignId, uint256 indexed shopId, address indexed creator, uint256 budget, uint256 fee, uint64 start, uint64 end)");

type LogLike = { args?: Record<string, unknown> };
type Shop = { creator: Address; token: Address; price: bigint; exists: boolean };
type Campaign = { shopId: bigint; creator: Address; token: Address; start: bigint; end: bigint; budget: bigint; activeStake: bigint; activeLockers: bigint; earlyExits: bigint; totalForfeited: bigint; completed: bigint; exists: boolean };
type Position = { amount: bigint; exists: boolean; principalWithdrawn: boolean; earlyExited: boolean; claimed: boolean; completionRecorded: boolean };
type Membership = { shopId: bigint; expiry: bigint; shop?: Shop };
type CampaignPosition = { id: bigint; campaign: Campaign; position: Position; earned: bigint; tokenDecimals: number; tokenSymbol: string; usdcDecimals: number };

function eventArg(log: LogLike, name: string) { return log.args?.[name]; }
function walletArg(log: LogLike, name: string, wallet: Address) { const value = eventArg(log, name); return typeof value === "string" && value.toLowerCase() === wallet.toLowerCase(); }
function uniqueIds(logs: LogLike[], name: string) { return [...new Set(logs.map((log) => eventArg(log, name)).filter((id): id is bigint => typeof id === "bigint"))]; }
function formatDate(seconds: bigint) { return new Date(Number(seconds) * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
function statusFor(campaign: Campaign, now: bigint) { return now < campaign.start ? "Enrollment open" : now < campaign.end ? "Active streaming" : "Completed"; }

async function boundedLogs(client: PublicClient, address: Address, event: AbiEvent, fromBlock: bigint, toBlock: bigint): Promise<LogLike[]> {
  try { return await client.getLogs({ address, event, fromBlock, toBlock }) as unknown as LogLike[]; }
  catch {
    const fallbackFrom = toBlock > 10_000n ? toBlock - 10_000n : 0n;
    return await client.getLogs({ address, event, fromBlock: fallbackFrom, toBlock }) as unknown as LogLike[];
  }
}

export function MyDashboard() {
  const { address } = useAccount(); const chainId = useChainId(); const client = usePublicClient();
  const [memberships, setMemberships] = useState<Membership[]>([]); const [positions, setPositions] = useState<CampaignPosition[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [coverage, setCoverage] = useState(""); const [asOf, setAsOf] = useState<bigint>(); const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!address || chainId !== publicConfig.chainId || !client || !isPublicChainReady || !isAddress(addresses.hub) || !isAddress(addresses.rewards)) { setMemberships([]); setPositions([]); setAsOf(undefined); return; }
    setLoading(true); setError("");
    try {
      const latest = await client.getBlockNumber();
      const earliest = latest > 50_000n ? latest - 50_000n : 0n;
      const cursorKey = `loydura:event-cursor:${address.toLowerCase()}`;
      let previous = 0n; try { previous = BigInt(window.localStorage.getItem(cursorKey) || "0"); } catch { previous = 0n; }
      const overlap = 128n;
      const fromBlock = previous > overlap ? (previous - overlap > earliest ? previous - overlap : earliest) : earliest;
      const [membershipLogs, lockedLogs, unlockedLogs, claimLogs, campaignLogs] = await Promise.all([
        boundedLogs(client, addresses.hub as Address, membershipEvent, fromBlock, latest),
        boundedLogs(client, addresses.rewards as Address, lockedEvent, fromBlock, latest),
        boundedLogs(client, addresses.rewards as Address, unlockedEvent, fromBlock, latest),
        boundedLogs(client, addresses.rewards as Address, rewardClaimedEvent, fromBlock, latest),
        boundedLogs(client, addresses.rewards as Address, campaignCreatedEvent, fromBlock, latest)
      ]);
      const membershipIds = uniqueIds(membershipLogs.filter((log) => walletArg(log, "buyer", address)), "shopId");
      const campaignIds = [...new Set([
        ...uniqueIds(lockedLogs.filter((log) => walletArg(log, "member", address)), "campaignId"),
        ...uniqueIds(unlockedLogs.filter((log) => walletArg(log, "member", address)), "campaignId"),
        ...uniqueIds(claimLogs.filter((log) => walletArg(log, "member", address)), "campaignId"),
        ...uniqueIds(campaignLogs.filter((log) => walletArg(log, "creator", address)), "campaignId")
      ])];
      const block = await client.getBlock({ blockNumber: latest }); setAsOf(block.timestamp);
      const nextMemberships = (await Promise.all(membershipIds.map(async (shopId): Promise<Membership | null> => {
        try {
          const [shop, expiry] = await Promise.all([
            client.readContract({ address: addresses.hub as Address, abi: hubAbi, functionName: "getShop", args: [shopId] }) as Promise<Shop>,
            client.readContract({ address: addresses.hub as Address, abi: hubAbi, functionName: "membershipExpires", args: [shopId, address] })
          ]);
          return { shopId, expiry: expiry as bigint, shop };
        } catch { return null; }
      }))).filter((value): value is Membership => value !== null).sort((a, b) => Number(b.shopId - a.shopId));
      const usdcDecimals = isAddress(addresses.usdc) ? Number(await client.readContract({ address: addresses.usdc as Address, abi: erc20Abi, functionName: "decimals" })) : 6;
      const nextPositions = (await Promise.all(campaignIds.map(async (id): Promise<CampaignPosition | null> => {
        try {
          const campaign = await client.readContract({ address: addresses.rewards as Address, abi: rewardsAbi, functionName: "getCampaign", args: [id] }) as Campaign;
          const [position, earned, tokenDecimals, tokenSymbol] = await Promise.all([
            client.readContract({ address: addresses.rewards as Address, abi: rewardsAbi, functionName: "getPosition", args: [id, address] }) as Promise<Position>,
            client.readContract({ address: addresses.rewards as Address, abi: rewardsAbi, functionName: "previewEarned", args: [id, address] }) as Promise<bigint>,
            client.readContract({ address: campaign.token, abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
            client.readContract({ address: campaign.token, abi: erc20Abi, functionName: "symbol" }) as Promise<string>
          ]);
          return { id, campaign, position, earned, tokenDecimals: Number(tokenDecimals), tokenSymbol, usdcDecimals };
        } catch { return null; }
      }))).filter((value): value is CampaignPosition => value !== null).sort((a, b) => Number(b.id - a.id));
      setMemberships(nextMemberships); setPositions(nextPositions); setCoverage(`Indexed a bounded ${fromBlock.toString()}–${latest.toString()} block window with a ${overlap}-block reorganization overlap.`);
      try { window.localStorage.setItem(cursorKey, latest.toString()); } catch { /* storage is optional */ }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet activity could not be read from Elysium."); setCoverage("No activity is shown when the bounded event read fails."); }
    finally { setLoading(false); }
  }, [address, chainId, client, refreshKey]);

  useEffect(() => { void refresh(); }, [refresh]);
  const activeMemberships = useMemo(() => memberships.filter((membership) => asOf !== undefined && membership.expiry > asOf).length, [asOf, memberships]);
  const claimable = positions.filter((entry) => asOf !== undefined && asOf >= entry.campaign.end && !entry.position.claimed && !entry.position.earlyExited).length;

  return <div className="page-shell"><PageIntro eyebrow="MY DASHBOARD / WALLET ACTIVITY" title="Your commitments, without the scavenger hunt." description="Memberships, campaign positions, claims, and principal recovery are discovered from verified wallet events, then refreshed against current contract state." actions={<button className="button button-outline" type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} aria-hidden="true" /> {loading ? "Reading…" : "Refresh wallet"}</button>} /><ChainConfigNotice />
    {!address ? <EmptyState icon={<WalletCards size={25} />} title="Connect your wallet to see your activity." description="Loydura does not ask you to type a shop ID. Once connected, the dashboard finds your verified Elysium activity automatically." /> : chainId !== publicConfig.chainId ? <EmptyState title="Switch to Elysium Testnet." description={`Dashboard reads are available on chain ${publicConfig.chainId}.`} /> : <div className="stack"><section className="dashboard-identity"><div><p className="eyebrow">CONNECTED WALLET</p><h2 className="mono">{address.slice(0, 8)}…{address.slice(-6)}</h2><p className="subtle">As of {asOf ? formatDate(asOf) : "the latest verified block"}</p></div><VerifiedLabel>Live contract state</VerifiedLabel></section>{coverage && <p className="tiny">{coverage}</p>}{error ? <ErrorState description={error} onRetry={() => setRefreshKey((key) => key + 1)} /> : loading && !memberships.length && !positions.length ? <LoadingState label="Discovering wallet activity…" /> : <><div className="metrics"><MetricCard label="Active memberships" value={activeMemberships} detail="Current expiry checked on chain" tone="accent" /><MetricCard label="Campaign positions" value={positions.length} detail="Bounded event discovery" /><MetricCard label="Claimable campaigns" value={claimable} detail="End reached, claim still pending" tone="gold" /></div><section className="stack"><SectionHeading eyebrow="MEMBERSHIPS" title="Access you purchased" description="Current expiry and token contract are read from the Hub. A stale event cannot keep access alive." />{!memberships.length ? <EmptyState title="No memberships found in the indexed window." description="Purchase a creator membership from Discover, then refresh after the receipt confirms. The index is intentionally bounded for safe browser loads." action={<Link className="button button-outline button-small" href="/discover">Explore storefronts</Link>} /> : <div className="card-grid">{memberships.map((membership) => { const active = asOf !== undefined && membership.expiry > asOf; return <article className="catalog-card" key={membership.shopId.toString()}><div className="campaign-card-top"><span className="eyebrow">SHOP #{membership.shopId.toString()}</span><StatusBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Expired"}</StatusBadge></div><strong>{active ? "Member access" : "Renew your access"}</strong><p className="subtle">Expires {formatDate(membership.expiry)}</p><p className="tiny mono">Token {membership.shop?.token}</p><Link className="button button-outline button-small" href={`/shop/${membership.shopId}`}>{active ? "Open storefront" : "Renew membership"}</Link></article>; })}</div>}</section><section className="stack"><SectionHeading eyebrow="CAMPAIGN POSITIONS" title="Your commitments and settlement state" description="Accrued rewards are estimates until the campaign ends. Principal withdrawal and reward claims are separate contract actions." />{!positions.length ? <EmptyState icon={<Activity size={23} />} title="No campaign positions found." description="Eligible campaign participation will appear here after its lock receipt is indexed." action={<Link className="button button-outline button-small" href="/discover">Find a campaign</Link>} /> : <div className="card-grid">{positions.map((entry) => { const status = entry.position.earlyExited ? "Early exited" : entry.position.claimed ? "Reward claimed" : entry.position.principalWithdrawn ? "Principal withdrawn" : statusFor(entry.campaign, asOf || 0n); return <article className="catalog-card" key={entry.id.toString()}><div className="campaign-card-top"><span className="eyebrow">CAMPAIGN #{entry.id.toString()}</span><StatusBadge tone={entry.position.earlyExited ? "danger" : entry.position.claimed ? "success" : "accent"}>{status}</StatusBadge></div><strong>{formatUnits(entry.position.amount, entry.tokenDecimals)} {entry.tokenSymbol} locked</strong><p className="subtle">Ends {formatDate(entry.campaign.end)} · {formatUnits(entry.earned, entry.usdcDecimals)} USDC accrued estimate</p><div className="tiny">{entry.position.principalWithdrawn ? "Principal returned" : "Principal available after settlement"}{entry.position.claimed ? " · Reward claimed" : ""}</div><Link className="button button-outline button-small" href={`/campaign/${entry.id}`}>Open campaign <ExternalLink size={13} aria-hidden="true" /></Link></article>; })}</div>}</section><section className="notice"><Clock3 size={18} aria-hidden="true" /><p>Wallet activity uses bounded recent event reads and rechecks current state. Older history may require an indexed backend query; the UI never presents a failed RPC read as an empty wallet.</p></section></>}</div>}
  </div>;
}
