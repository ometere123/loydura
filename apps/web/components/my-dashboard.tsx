"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { hubAbi, addresses } from "@loydura/chain";
import { CampaignFeed } from "./campaign";
import Link from "next/link";
import type { Address } from "viem";
export function MyDashboard(){
 const {address}=useAccount();const [shopId,setShopId]=useState("");
 const {data:expiry}=useReadContract({address:addresses.hub as Address,abi:hubAbi,functionName:"membershipExpires",args:[BigInt(/^\d+$/.test(shopId)?shopId:"0"),address||"0x0000000000000000000000000000000000000000"],query:{enabled:!!address&&Number(shopId)>0}});
 return <div className="stack wide"><h1>My Loydura</h1><p className="subtle">Wallet-specific activity is always read from the deployed contracts. Campaign claims remain available after principal withdrawal.</p>
  {!address?<p className="panel">Connect your wallet to view memberships and campaign positions.</p>:<div className="panel stack"><p className="mono tiny">Wallet: {address}</p>
   <label>Inspect membership by shop ID<input type="number" min="1" value={shopId} onChange={e=>setShopId(e.target.value)}/></label>
   {expiry!==undefined&&<p>Membership expires: {expiry===0n?"No purchase":new Date(Number(expiry)*1000).toLocaleString()} {expiry>BigInt(Math.floor(Date.now()/1000))?"· Active":"· Expired"}</p>}
   {shopId&&<Link href={`/shop/${shopId}`}>View selected shop →</Link>}
  </div>}
  <h2>Campaigns</h2><p className="subtle">Open a campaign to inspect and claim your wallet's rewards.</p><CampaignFeed/>
 </div>
}
