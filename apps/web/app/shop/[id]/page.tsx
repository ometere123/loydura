"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useBlock, useReadContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { addresses, erc20Abi, hubAbi, isAddress, isPublicChainReady, rewardsAbi } from "@loydura/chain";
import { BackLink, ChainConfigNotice, EmptyState, ErrorState, LoadingState, PageIntro, SectionHeading, StatusBadge, VerifiedLabel } from "@/components/design-system";
import { MembershipCheckout } from "@/components/actions";
import { MemberContent } from "@/components/content";

type Profile = { name: string; description: string; ascend_launch_url: string | null };
type Shop = { creator: Address; token: Address; price: bigint; exists: boolean };
type Campaign = { shopId: bigint; start: bigint; end: bigint; budget: bigint; activeLockers: bigint; exists: boolean };
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function ShopCampaign({ id, shopId }: { id: bigint; shopId: bigint }) {
  const { data } = useReadContract({ address: addresses.rewards as Address, abi: rewardsAbi, functionName: "getCampaign", args: [id], query: { enabled: isPublicChainReady && isAddress(addresses.rewards) } });
  const { data: decimals } = useReadContract({ address: addresses.usdc as Address, abi: erc20Abi, functionName: "decimals", query: { enabled: isAddress(addresses.usdc) } });
  const campaign = data as Campaign | undefined;
  if (!campaign || campaign.shopId !== shopId) return null;
  return <Link className="catalog-card" href={`/campaign/${id}`}><div className="campaign-card-top"><span className="eyebrow">CAMPAIGN #{id.toString()}</span><StatusBadge tone="accent">Open details</StatusBadge></div><strong>{formatUnits(campaign.budget, decimals ?? 6)} USDC funded</strong><p className="subtle">Ends {new Date(Number(campaign.end) * 1000).toLocaleDateString()} · {campaign.activeLockers.toString()} active lockers</p><span className="text-link">Review campaign rules <ArrowRight size={14} aria-hidden="true" /></span></Link>;
}

function ShopCampaigns({ shopId }: { shopId: bigint }) {
  const { data: last, isLoading, error, refetch } = useReadContract({ address: addresses.rewards as Address, abi: rewardsAbi, functionName: "nextCampaignId", query: { enabled: isPublicChainReady && isAddress(addresses.rewards), refetchInterval: 30_000 } });
  const ids = useMemo(() => { const result: bigint[] = []; if (last === undefined) return result; for (let id = (last as bigint) - 1n; id >= 1n && result.length < 20; id--) result.push(id); return result; }, [last]);
  if (isLoading) return <LoadingState label="Looking for linked campaigns…" />;
  if (error) return <ErrorState description="The campaign index could not be read. This is not proof that no campaigns exist." onRetry={() => void refetch()} />;
  return <div className="card-grid">{ids.map((id) => <ShopCampaign key={id.toString()} id={id} shopId={shopId} />)}</div>;
}

export default function ShopPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id || "");
  const valid = /^\d{1,15}$/.test(id) && Number(id) > 0;
  const shopId = useMemo(() => valid ? BigInt(id) : 0n, [id, valid]);
  const { address } = useAccount();
  const { data: block } = useBlock({ watch: true, query: { enabled: isPublicChainReady } });
  const [profile, setProfile] = useState<Profile | null>(null); const [profileError, setProfileError] = useState(false);
  const hub = addresses.hub as Address;
  const { data: rawShop, isLoading, error, refetch } = useReadContract({ address: hub, abi: hubAbi, functionName: "getShop", args: [shopId], query: { enabled: valid && isPublicChainReady && isAddress(addresses.hub) } });
  const shop = rawShop as Shop | undefined;
  const { data: expiry } = useReadContract({ address: hub, abi: hubAbi, functionName: "membershipExpires", args: [shopId, address || ZERO_ADDRESS], query: { enabled: Boolean(address && shop) } });
  useEffect(() => {
    if (!valid) return;
    let active = true;
    fetch(`/api/shop?shopId=${id}`, { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Profile unavailable"); if (active) { setProfile(body.profile || null); setProfileError(false); } }).catch(() => { if (active) { setProfile(null); setProfileError(true); } });
    return () => { active = false; };
  }, [id, valid]);
  if (!valid) return <div className="page-shell"><BackLink href="/discover">Back to Discover</BackLink><EmptyState title="Invalid storefront ID." description="Choose a storefront from Discover to inspect its verified contract state." /></div>;
  if (!isPublicChainReady) return <div className="page-shell"><BackLink href="/discover">Back to Discover</BackLink><ChainConfigNotice /></div>;
  if (isLoading) return <div className="page-shell"><BackLink href="/discover">Back to Discover</BackLink><LoadingState label="Loading verified storefront…" /></div>;
  if (error || !shop) return <div className="page-shell"><BackLink href="/discover">Back to Discover</BackLink><ErrorState title="Storefront unavailable." description="The Hub did not return this shop from the configured Elysium deployment." onRetry={() => void refetch()} /></div>;
  const active = expiry !== undefined && block?.timestamp !== undefined && expiry > block.timestamp;
  return <div className="page-shell"><BackLink href="/discover">Back to Discover</BackLink><PageIntro eyebrow={`CREATOR STOREFRONT #${id}`} title={profile?.name || `Creator Shop #${id}`} description={profile?.description || "This storefront exists on Elysium. The creator has not published profile copy yet."} actions={<div className="stack">{profileError ? <StatusBadge tone="warning">Profile metadata unavailable</StatusBadge> : <VerifiedLabel>On-chain storefront verified</VerifiedLabel>}{profile?.ascend_launch_url && <a className="button button-outline button-small" href={profile.ascend_launch_url} target="_blank" rel="noopener noreferrer">Creator-submitted Ascend link <ExternalLink size={13} aria-hidden="true" /></a>}</div>} />
    <section className="storefront-layout"><div className="stack"><MembershipCheckout shopId={shopId} token={shop.token} price={shop.price} /><div className="panel stack"><SectionHeading eyebrow="THE MEMBER EXPERIENCE" title="Access with a clear contract boundary." description="One confirmed purchase grants 30 days of creator-defined access; renewal extends the current expiry." /><div className="detail-grid"><div><span className="metric-label">Membership status</span><strong>{address ? active ? "Active" : "Not active" : "Connect to check"}</strong>{address && expiry !== undefined && <span className="tiny">{active ? `Through ${new Date(Number(expiry) * 1000).toLocaleDateString()}` : "Purchase or renew below"}</span>}</div><div><span className="metric-label">Payment token</span><a className="mono tiny" href={`https://elysium.kinetiq.xyz/testnet-explorer/address/${shop.token}`} target="_blank" rel="noreferrer">{shop.token}</a></div><div><span className="metric-label">Creator</span><a className="mono tiny" href={`https://elysium.kinetiq.xyz/testnet-explorer/address/${shop.creator}`} target="_blank" rel="noreferrer">{shop.creator}</a></div><div><span className="metric-label">Access term</span><strong>30 days</strong><span className="tiny">Fixed by the Hub contract</span></div></div><p className="tiny">Creator launch provenance is submitted metadata unless independently verified. Review token code and transaction receipts before interacting.</p></div></div><aside className="stack"><div className="panel stack"><SectionHeading eyebrow="LOYALTY" title="Linked campaigns" description="Campaigns are matched to this shop from live Rewards contract reads." /><ShopCampaigns shopId={shopId} /></div><div className="panel stack"><SectionHeading eyebrow="TRANSPARENCY" title="Inspect the deployment" description="Financial settlement and membership ownership remain on Elysium; the Worker only handles authenticated metadata and protected content delivery." /><a className="button button-outline" href={`https://elysium.kinetiq.xyz/testnet-explorer/address/${hub}`} target="_blank" rel="noreferrer">View Hub contract <ExternalLink size={14} aria-hidden="true" /></a></div></aside></section><MemberContent shopId={Number(shopId)} />
  </div>;
}
