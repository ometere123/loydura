"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { hubAbi } from "@loydura/chain";
import { MembershipCheckout } from "@/components/actions";
import { MemberContent } from "@/components/content";
import { addresses, isAddress } from "@loydura/chain";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
interface Profile {name:string;description:string;ascend_launch_url:string|null}
export default function ShopPage(){
  const params=useParams<{id:string}>();const id=String(params.id||"");const valid=/^\d{1,15}$/.test(id)&&Number(id)>0;const shopId=useMemo(()=>valid?BigInt(id):0n,[id,valid]);
  const [profile,setProfile]=useState<Profile|null>(null);
  const hub=addresses.hub as Address;
  const {data:shop,isLoading,error}=useReadContract({address:hub,abi:hubAbi,functionName:"getShop",args:[shopId],query:{enabled:valid&&isAddress(addresses.hub)}});
  useEffect(()=>{if(!valid)return;fetch(`/api/shop?shopId=${id}`,{cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"Shop unavailable");setProfile(data.profile)}).catch(()=>setProfile(null))},[id,valid]);
  if(!valid)return <div className="panel"><p>Invalid shop ID.</p></div>;
  if(isLoading)return <div className="stack wide"><p className="subtle">Loading verified shop…</p></div>;
  if(error||!shop)return <div className="panel"><p>Shop unavailable. Check the configured Hub deployment and network.</p></div>;
  return <div className="stack wide"><section className="heading"><div><p className="eyebrow">ONCHAIN STOREFRONT #{id}</p><h1>{profile?.name||`Creator Shop #${id}`}</h1>
    <p className="subtle">{profile?.description||"This shop exists on chain. Profile details have not been published."}</p>
    {profile?.ascend_launch_url&&<a href={profile.ascend_launch_url} target="_blank" rel="noopener noreferrer" className="tiny">Creator-submitted Ascend launch link ↗ (not independently verified)</a>}
  </div></section>
  <div className="grid2"><MembershipCheckout shopId={shopId} token={shop.token} price={shop.price}/>
    <div className="panel stack"><h3>Verified contract facts</h3><p><strong>Creator:</strong> <span className="mono tiny">{shop.creator}</span></p>
    <p><strong>Token:</strong> <span className="mono tiny">{shop.token}</span></p><p><strong>Access:</strong> 30 days per checkout</p>
    <p className="subtle">Token provenance is not independently certified by submitting a launch URL. Always review the token contract.</p></div></div>
  <MemberContent shopId={Number(id)}/>
  </div>;
}
