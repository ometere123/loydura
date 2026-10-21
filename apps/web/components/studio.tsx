"use client";

import Link from "next/link";
import { RefreshCw, ShieldCheck, Store, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { addresses, hubAbi, isAddress, isPublicChainReady, publicConfig } from "@loydura/chain";
import { ChainConfigNotice, EmptyState, ErrorState, LoadingState, PageIntro, SectionHeading, StepList, StatusBadge, VerifiedLabel } from "@/components/design-system";
import { CreateCampaignForm, CreateShopForm, type StudioShopOption } from "@/components/actions";
import { ContentEditor, CreatorContentList } from "@/components/content";

const shopCreatedEvent = parseAbiItem("event ShopCreated(uint256 indexed shopId, address indexed creator, address indexed token, uint256 price)");
type OnchainShop = { creator: Address; token: Address; price: bigint; exists: boolean };
type Profile = { name: string; description: string; ascend_launch_url: string | null } | null;
export type OwnedShop = OnchainShop & { shopId: number; profile: Profile; metadataUnavailable?: boolean };

function displayName(shop: OwnedShop) { return shop.profile?.name || `Creator storefront #${shop.shopId}`; }

async function fetchProfile(shopId: number): Promise<{ profile: Profile; unavailable: boolean }> {
  try {
    const response = await fetch(`/api/shop?shopId=${shopId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return { profile: null, unavailable: true };
    return { profile: data.profile || null, unavailable: false };
  } catch {
    return { profile: null, unavailable: true };
  }
}

export function StudioWorkspace() {
  const { address } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient();
  const [shops, setShops] = useState<OwnedShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coverage, setCoverage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [contentRefresh, setContentRefresh] = useState(0);

  const refresh = useCallback(async () => {
    if (!address || chainId !== publicConfig.chainId || !client || !isPublicChainReady || !isAddress(addresses.hub)) {
      setShops([]);
      setSelectedShopId(undefined);
      setCoverage("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const latest = await client.getBlockNumber();
      const requestedFrom = latest > 50_000n ? latest - 50_000n : 0n;
      let fromBlock = requestedFrom;
      let logs;
      try {
        logs = await client.getLogs({ address: addresses.hub as Address, event: shopCreatedEvent, fromBlock, toBlock: latest });
      } catch {
        fromBlock = latest > 10_000n ? latest - 10_000n : 0n;
        logs = await client.getLogs({ address: addresses.hub as Address, event: shopCreatedEvent, fromBlock, toBlock: latest });
      }
      const ids = [...new Set(logs
        .filter((log) => String((log.args as { creator?: string } | undefined)?.creator || "").toLowerCase() === address.toLowerCase())
        .map((log) => (log.args as { shopId?: bigint } | undefined)?.shopId)
        .filter((id): id is bigint => id !== undefined))];
      const discovered = (await Promise.all(ids.map(async (id): Promise<OwnedShop | null> => {
        try {
          const shop = await client.readContract({ address: addresses.hub as Address, abi: hubAbi, functionName: "getShop", args: [id] }) as OnchainShop;
          if (!shop.exists || shop.creator.toLowerCase() !== address.toLowerCase()) return null;
          const shopId = Number(id);
          const metadata = await fetchProfile(shopId);
          return { ...shop, shopId, profile: metadata.profile, metadataUnavailable: metadata.unavailable };
        } catch { return null; }
      }))).filter((shop): shop is OwnedShop => shop !== null).sort((a, b) => b.shopId - a.shopId);
      setShops(discovered);
      setSelectedShopId((current) => current && discovered.some((shop) => shop.shopId === current) ? current : discovered[0]?.shopId);
      setCoverage(`Verified from ShopCreated events in blocks ${fromBlock.toString()}–${latest.toString()}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Elysium event index could not be read.");
      setCoverage("No ownership claim is shown when the event read fails.");
    } finally { setLoading(false); }
  }, [address, chainId, client, refreshKey]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedShop = useMemo(() => shops.find((shop) => shop.shopId === selectedShopId), [shops, selectedShopId]);
  const options: StudioShopOption[] = shops.map((shop) => ({ shopId: shop.shopId, name: displayName(shop), token: shop.token }));

  return <div className="page-shell">
    <PageIntro eyebrow="CREATOR STUDIO / ON-CHAIN CONTROL" title="Launch utility with the details in view." description="One workspace for your verified storefronts, protected member content, and funded commitment campaigns. Ownership comes from Elysium events and current contract state—not a manually entered shop ID." actions={<Link className="button button-outline" href="/discover">View Discover</Link>} />
    <ChainConfigNotice />
    {!address ? <EmptyState icon={<WalletCards size={25} />} title="Connect the creator wallet to begin." description="The Studio discovers storefronts owned by the connected Elysium wallet. Connect from the navigation bar, then sign in when you publish metadata or content." /> : chainId !== publicConfig.chainId ? <EmptyState title="Switch to Elysium Testnet." description={`Loydura creator actions are available on chain ${publicConfig.chainId}. Your connected wallet is on ${chainId || "an unknown network"}.`} /> : <div className="studio-layout">
      <aside className="studio-rail panel stack"><div><p className="eyebrow">WORKSPACE</p><h2>Your storefronts</h2><p>Recent on-chain ShopCreated events are verified against live owner state.</p></div><button className="button button-quiet button-small" type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} aria-hidden="true" /> {loading ? "Refreshing…" : "Refresh ownership"}</button>{coverage && <p className="tiny">{coverage}</p>}{error && <p className="tiny" role="alert">{error}</p>}<StepList steps={["Connect and sign in", "Select or create a storefront", "Publish member content", "Fund a loyalty campaign"]} current={selectedShop ? 2 : 1} /><div className="rail-divider" />{loading && !shops.length ? <LoadingState label="Discovering owned storefronts…" /> : shops.length ? <div className="shop-selector" role="list" aria-label="Your verified storefronts">{shops.map((shop) => <button key={shop.shopId} className={shop.shopId === selectedShopId ? "shop-option selected" : "shop-option"} type="button" onClick={() => setSelectedShopId(shop.shopId)}><Store size={15} aria-hidden="true" /><span><strong>{displayName(shop)}</strong><small>Shop #{shop.shopId}</small></span></button>)}</div> : <EmptyState icon={<Store size={23} />} title="No verified storefronts yet." description="Create the first one below. The receipt resolves its ID automatically." />}</aside>
      <main className="studio-content stack">
        {selectedShop ? <section className="studio-topbar"><div><p className="eyebrow">SELECTED STOREFRONT #{selectedShop.shopId}</p><h1>{displayName(selectedShop)}</h1><p>{selectedShop.profile?.description || "On-chain storefront created; publish a profile to explain the member experience."}</p>{selectedShop.metadataUnavailable && <StatusBadge tone="warning">Profile metadata unavailable — on-chain ownership is still verified</StatusBadge>}</div><div className="studio-topbar-actions"><VerifiedLabel>Owner verified on Elysium</VerifiedLabel><Link className="button button-outline button-small" href={`/shop/${selectedShop.shopId}`}>Open storefront</Link></div></section> : <div className="notice"><ShieldCheck size={18} aria-hidden="true" /><div><strong>Start with a real storefront.</strong><p>Once the chain confirms creation, the new shop ID remains in this workspace even if metadata publication needs a retry.</p></div></div>}
        <SectionHeading eyebrow="ONBOARDING" title="Create or manage your utility surface." description="The on-chain terms are explicit before the wallet prompt. Metadata and content remain retryable through the Worker." />
        <CreateShopForm onCreated={(shopId) => { setSelectedShopId(shopId); setRefreshKey((key) => key + 1); }} />
        <div className="studio-section-grid"><div className="stack"><SectionHeading eyebrow="PROTECTED CONTENT" title="Give members something worth accessing." description="Select a verified shop, publish a text post or private file, and review its publication state." /><ContentEditor shops={options} selectedShopId={selectedShopId} onSelectShop={setSelectedShopId} onPublished={() => setContentRefresh((key) => key + 1)} />{selectedShop && <CreatorContentList shopId={selectedShop.shopId} refreshKey={contentRefresh} />}</div><div className="stack"><SectionHeading eyebrow="LOYALTY CAMPAIGN" title="Fund commitment, not speculation." description="Reward budgets are deposited upfront; eligibility, duration, forfeiture, claims, and principal return remain contract-defined." /><CreateCampaignForm shops={options} selectedShopId={selectedShopId} onCreated={() => setContentRefresh((key) => key + 1)} /></div></div>
      </main>
    </div>}
  </div>;
}
