"use client";

import Link from "next/link";
import { Search, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { addresses, erc20Abi, hubAbi, isAddress, isPublicChainReady, publicConfig, rewardsAbi } from "@loydura/chain";
import { ChainConfigNotice, EmptyState, ErrorState, LoadingState, PageIntro, SectionHeading, StatusBadge, VerifiedLabel } from "@/components/design-system";

type ShopProfile = { shop_id: number; name: string; description: string; token_address: string; creator_address: string; ascend_launch_url?: string | null; created_at?: string };
type CampaignState = "all" | "enrollment" | "active" | "completed";
type CampaignData = { shopId: bigint; creator: Address; token: Address; start: bigint; end: bigint; budget: bigint; activeStake: bigint; activeLockers: bigint; earlyExits: bigint; totalForfeited: bigint; completed: bigint; exists: boolean };

function shortAddress(value: string) { return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value; }
function formatDate(value: bigint) { return new Date(Number(value) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function stateFor(c: CampaignData): Exclude<CampaignState, "all"> { const now = BigInt(Math.floor(Date.now() / 1000)); return now < c.start ? "enrollment" : now < c.end ? "active" : "completed"; }

function ShopCard({ shop }: { shop: ShopProfile }) {
  const { data: onchain } = useReadContract({ address: addresses.hub as Address, abi: hubAbi, functionName: "getShop", args: [BigInt(shop.shop_id)], query: { enabled: isPublicChainReady && isAddress(addresses.hub) } });
  const token = (onchain as { token?: Address } | undefined)?.token;
  const { data: decimals } = useReadContract({ address: token as Address, abi: erc20Abi, functionName: "decimals", query: { enabled: Boolean(token) } });
  const { data: symbol } = useReadContract({ address: token as Address, abi: erc20Abi, functionName: "symbol", query: { enabled: Boolean(token) } });
  const price = (onchain as { price?: bigint } | undefined)?.price;
  return <Link className="catalog-card" href={`/shop/${shop.shop_id}`}>
    <div className="campaign-card-top"><span className="eyebrow">STOREFRONT #{shop.shop_id}</span><VerifiedLabel /></div>
    <strong>{shop.name}</strong><span className="subtle">{shop.description || "A creator storefront with token-powered member access."}</span>
    <div className="card-footer"><span className="tiny mono">{shortAddress(shop.token_address)}</span><span className="tiny">{price !== undefined ? `${formatUnits(price, decimals ?? 18)} ${symbol || "tokens"}` : "Price on chain"}</span></div>
  </Link>;
}

function CampaignCard({ id, shops, filter }: { id: bigint; shops: ShopProfile[]; filter: CampaignState }) {
  const { data, isLoading, error } = useReadContract({ address: addresses.rewards as Address, abi: rewardsAbi, functionName: "getCampaign", args: [id], query: { enabled: isPublicChainReady && isAddress(addresses.rewards), refetchInterval: 30_000 } });
  const { data: usdcDecimals } = useReadContract({ address: addresses.usdc as Address, abi: erc20Abi, functionName: "decimals", query: { enabled: isPublicChainReady && isAddress(addresses.usdc) } });
  const c = data as CampaignData | undefined;
  if (isLoading) return <div className="campaign-card"><LoadingState label="Reading campaign…" /></div>;
  if (error || !c) return <div className="campaign-card"><StatusBadge tone="danger">Read failed</StatusBadge><p className="subtle">Campaign #{id.toString()} could not be read from the deployed contract.</p></div>;
  const state = stateFor(c);
  const shop = shops.find((entry) => entry.shop_id === Number(c.shopId));
  if (filter !== "all" && filter !== state) return null;
  return <Link className="campaign-card" href={`/campaign/${id}`}>
    <div className="campaign-card-top"><span className="eyebrow">CAMPAIGN #{id.toString()}</span><StatusBadge tone={state === "completed" ? "neutral" : state === "active" ? "success" : "warning"}>{state}</StatusBadge></div>
    <h3>{shop?.name || `Creator storefront #${c.shopId.toString()}`}</h3>
    <p className="subtle">{formatDate(c.start)} → {formatDate(c.end)} · {c.activeLockers.toString()} active lockers</p>
    <div className="campaign-footer"><div><strong>{formatUnits(c.budget, usdcDecimals ?? 6)} USDC</strong><span>funded reward pool</span></div><ArrowRight size={17} aria-hidden="true" /></div>
  </Link>;
}

function CampaignBrowser({ shops }: { shops: ShopProfile[] }) {
  const [filter, setFilter] = useState<CampaignState>("all");
  const { data: last, isLoading, error, refetch } = useReadContract({ address: addresses.rewards as Address, abi: rewardsAbi, functionName: "nextCampaignId", query: { enabled: isPublicChainReady && isAddress(addresses.rewards), refetchInterval: 30_000 } });
  const ids = useMemo(() => { if (last === undefined) return []; const result: bigint[] = []; for (let id = (last as bigint) - 1n; id >= 1n && result.length < 20; id--) result.push(id); return result; }, [last]);
  if (!isPublicChainReady) return <><ChainConfigNotice /></>;
  if (isLoading) return <LoadingState label="Reading live campaign index…" />;
  if (error) return <ErrorState title="Campaigns could not be read." description="The RPC did not return a campaign index. This is a network error, not proof that no campaigns exist." onRetry={() => void refetch()} />;
  if (!ids.length) return <EmptyState title="No campaigns are live yet." description="Creators can fund the first loyalty campaign from Creator Studio. No sample campaigns are displayed." action={<Link className="button button-outline button-small" href="/studio">Open Creator Studio <ArrowRight size={14} aria-hidden="true" /></Link>} />;
  return <div className="stack"><div className="filter-row"><span>Show</span><select aria-label="Campaign state filter" value={filter} onChange={event => setFilter(event.target.value as CampaignState)}><option value="all">All states</option><option value="enrollment">Enrollment open</option><option value="active">Active</option><option value="completed">Completed</option></select><span className="section-meta">latest {ids.length} campaigns · bounded read</span></div><div className="card-grid">{ids.map(id => <CampaignCard key={id.toString()} id={id} filter={filter} shops={shops} />)}</div></div>;
}

export default function Discover() {
  const [shops, setShops] = useState<ShopProfile[]>([]);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadShops = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/shop", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Directory unavailable"); setShops(Array.isArray(data.shops) ? data.shops : []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Directory unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadShops(); }, [loadShops]);
  const filtered = useMemo(() => { const normalized = query.trim().toLowerCase(); if (!normalized) return shops; return shops.filter(shop => [shop.name, shop.creator_address, shop.token_address, String(shop.shop_id)].some(value => value.toLowerCase().includes(normalized))); }, [query, shops]);
  const visible = filtered.slice(0, visibleCount);
  return <div className="page-shell">
    <PageIntro eyebrow="DISCOVER / VERIFIED READS" title="Find utility worth committing to." description="Explore creator storefronts, member access, and funded loyalty campaigns. Directory metadata comes from the Worker; contract facts come from Elysium." actions={<Link className="button button-outline" href="/studio">Create a storefront <ArrowRight size={15} aria-hidden="true" /></Link>} />
    <ChainConfigNotice />
    <div className="discover-toolbar"><div className="search-field"><Search size={17} aria-hidden="true" /><input value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(12); }} placeholder="Search creator, token, or storefront ID" aria-label="Search storefronts by creator or token address" /></div><button className="button button-quiet" type="button" onClick={() => void loadShops()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} aria-hidden="true" /> Refresh</button></div>
    <section className="discover-section" aria-labelledby="storefronts-title"><SectionHeading eyebrow="STOREFRONTS" title="Creator products, not empty tickers." description={error ? "The directory request failed. Retry when the Worker is available; a failed request is not an empty directory." : `${filtered.length} storefront${filtered.length === 1 ? "" : "s"} match the current search.`} /><div aria-live="polite">{error ? <ErrorState description={error} onRetry={() => void loadShops()} /> : loading ? <LoadingState label="Loading storefront directory…" /> : !visible.length ? <EmptyState title={query ? "No storefronts match that search." : "No storefronts published yet."} description={query ? "Try a creator address, token address, or a shorter search." : "Be the first creator to turn a token into a useful membership."} action={<Link className="button button-outline button-small" href="/studio">Open Creator Studio <ArrowRight size={14} aria-hidden="true" /></Link>} /> : <><div className="catalog">{visible.map(shop => <ShopCard key={shop.shop_id} shop={shop} />)}</div>{visible.length < filtered.length && <div className="load-more"><button className="button button-outline" type="button" onClick={() => setVisibleCount(count => count + 12)}>Load more storefronts <ArrowRight size={14} aria-hidden="true" /></button></div>}</>}</div></section>
    <section className="discover-section" aria-labelledby="campaigns-title"><SectionHeading eyebrow="CAMPAIGNS" title="Commitment with the rules in view." description="Campaign state, dates, budget, and participant metrics are read from the deployed rewards contract." /><CampaignBrowser shops={shops} /></section>
    <section className="discover-section"><div className="notice"><ExternalLink size={17} aria-hidden="true" /><p>Contract reads are authoritative for balances, ownership, eligibility, and settlement. Creator-submitted launch links are shown as provenance claims, not independent certification.</p></div></section>
  </div>;
}
