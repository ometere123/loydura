"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CampaignFeed } from "@/components/campaign";
interface ShopProfile {shop_id:number;name:string;description:string;token_address:string;creator_address:string}
export default function Home(){
  const [shops,setShops]=useState<ShopProfile[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState(false);
  useEffect(()=>{fetch("/api/shop",{cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"Unable to load directory");setShops(data.shops||[])}).catch(()=>setError(true)).finally(()=>setLoading(false))},[]);
  return <div className="stack wide">
    <section className="hero"><p className="eyebrow">ASCEND ECOSYSTEM · ELYSIUM 99801</p><h1>Commerce meets <em>commitment.</em></h1>
      <p>Creators sell real token-powered memberships. Members lock tokens and earn funded USDC rewards for completing their commitment.</p>
      <div className="cta"><Link className="button-link" href="/studio">Build a storefront →</Link><Link className="outline-link" href="#campaigns">Explore live campaigns</Link></div>
    </section>
    <section className="stack"><div className="section-heading"><div><p className="eyebrow">REAL ON-CHAIN WORKFLOWS</p><h2>Creator storefronts</h2></div></div>
      {error?<div className="panel"><p>The storefront directory could not be loaded. No mock stores are displayed.</p></div>:loading?<p className="subtle">Loading verified storefronts…</p>:
        shops.length===0?<p className="subtle">No storefronts published yet. Be the first creator.</p>:<div className="catalog">{shops.map(s=><Link key={s.shop_id} className="catalog-card" href={`/shop/${s.shop_id}`}><span className="eyebrow">SHOP #{s.shop_id}</span><strong>{s.name}</strong><span className="subtle">{s.description.slice(0,135)}</span><span className="tiny mono">{s.token_address.slice(0,10)}…</span></Link>)}</div>}
    </section>
    <section className="stack" id="campaigns"><p className="eyebrow">CREATOR-FUNDED USDC REWARDS</p><h2>Commitment campaigns</h2><CampaignFeed/></section>
    <section className="features"><div><h3>Spend tokens on real products</h3><p>30-day creator memberships with real protected resources.</p></div><div><h3>Keep custody rules transparent</h3><p>Fixed reward pools, principal withdrawal and auditable forfeitures.</p></div><div><h3>Verify every step</h3><p>Public deployed contracts and on-chain transaction records.</p></div></section>
  </div>;
}
