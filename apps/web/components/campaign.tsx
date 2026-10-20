"use client";
import { useReadContract, useAccount } from "wagmi";
import { rewardsAbi, hubAbi, erc20Abi, addresses, isAddress } from "@loydura/chain";
import { formatUnits, type Address } from "viem";
import { OnchainAction, StakeForm } from "./actions";
import Link from "next/link";
const rewardAddress=addresses.rewards as Address;
const hubAddress=addresses.hub as Address;
function when(seconds:bigint){return new Date(Number(seconds)*1000).toLocaleString()}
export function CampaignPanel({id}:{id:bigint}){
  const {address}=useAccount();
  const {data:c,isLoading,error,refetch}=useReadContract({address:rewardAddress,abi:rewardsAbi,functionName:"getCampaign",args:[id],query:{refetchInterval:15000}});
  const {data:p,refetch:refetchP}=useReadContract({address:rewardAddress,abi:rewardsAbi,functionName:"getPosition",args:[id,address||"0x0000000000000000000000000000000000000000"],query:{enabled:!!address,refetchInterval:15000}});
  const {data:earned}=useReadContract({address:rewardAddress,abi:rewardsAbi,functionName:"previewEarned",args:[id,address||"0x0000000000000000000000000000000000000000"],query:{enabled:!!address,refetchInterval:15000}});
  const token=(c?.token||"0x0000000000000000000000000000000000000000") as Address;
  const {data:decimals}=useReadContract({address:token,abi:erc20Abi,functionName:"decimals",query:{enabled:!!c}});
  const {data:symbol}=useReadContract({address:token,abi:erc20Abi,functionName:"symbol",query:{enabled:!!c}});
  const {data:usdcDecimals}=useReadContract({address:addresses.usdc as Address,abi:erc20Abi,functionName:"decimals",query:{enabled:isAddress(addresses.usdc)}});
  const {data:memberExpiry}=useReadContract({address:hubAddress,abi:hubAbi,functionName:"membershipExpires",args:[c?.shopId||0n,address||"0x0000000000000000000000000000000000000000"],query:{enabled:!!c&&!!address}});
  if(isLoading)return <p className="subtle">Loading on-chain campaign…</p>;
  if(error||!c)return <div className="panel"><p>Campaign unavailable. Check contract deployment and network settings.</p><p className="tiny subtle">{error?.message}</p></div>;
  const now=BigInt(Math.floor(Date.now()/1000));const upcoming=now<c.start;const active=now>=c.start&&now<c.end;
  const isCreator=address?.toLowerCase()===c.creator.toLowerCase();
  return <div className="stack wide">
    <div className="heading"><div><p className="eyebrow">LOYALTY CAMPAIGN #{id.toString()}</p><h1>Earn USDC for completing your commitment</h1>
      <p className="subtle">Linked to <Link href={`/shop/${c.shopId}`}>Creator shop #{c.shopId.toString()}</Link></p></div>
      <span className="pill">{upcoming?"Enrollment":active?"Streaming":"Completed"}</span></div>
    <div className="metrics">
      <div className="metric"><span>Funded rewards</span><strong>{formatUnits(c.budget,usdcDecimals??6)} USDC</strong></div>
      <div className="metric"><span>Currently locked</span><strong>{formatUnits(c.activeStake,decimals||18)} {symbol||"tokens"}</strong></div>
      <div className="metric"><span>Active wallets</span><strong>{c.activeLockers.toString()}</strong></div>
      <div className="metric"><span>Early exits</span><strong>{c.earlyExits.toString()}</strong></div>
      <div className="metric"><span>Forfeited rewards</span><strong>{formatUnits(c.totalForfeited,usdcDecimals??6)} USDC</strong></div>
      <div className="metric"><span>Completed positions</span><strong>{c.completed.toString()}</strong></div>
    </div>
    <div className="panel stack"><h3>Fixed campaign terms</h3><p>Starts: {when(c.start)}</p><p>Ends: {when(c.end)}</p>
      <p className="subtle">Enrollment closes at start. Rewards are claimable only after the end. Lock principal always remains withdrawable; early exit forfeits all unclaimed rewards. Every member must have paid access through the end.</p>
      <p className="tiny mono">Creator token: {c.token}</p><p className="tiny mono">Creator: {c.creator}</p>
    </div>
    {address&&<div className="panel stack"><h3>Your position</h3>
      <p>Membership expires: {memberExpiry?when(memberExpiry):"Not purchased"} {memberExpiry&&memberExpiry>=c.end?"(eligible)":"(ineligible for new locks)"}</p>
      <p>Principal: {p?.exists?formatUnits(p.amount,decimals||18):"0"} {symbol||"tokens"}</p>
      <p>Estimated accrued USDC: {formatUnits(earned||0n,usdcDecimals??6)}</p>
      <p className="tiny subtle">Accrual may change after another participant forfeits. A displayed estimate is not a claimable balance before campaign end.</p>
      {upcoming&&!p?.exists&&<StakeForm campaignId={id} token={token} entryOpen={true}/>}
      {p?.exists&&!p.principalWithdrawn&&<OnchainAction kind="unlock" campaignId={id} label={now<c.end?"Exit early and recover principal":"Withdraw principal"}
        confirm={now<c.end?"You will permanently forfeit ALL unpaid USDC rewards. You will recover only the locked tokens. Continue?":undefined}/>}
      {p?.exists&&!p.earlyExited&&now>=c.end&&!p.claimed&&<OnchainAction kind="claim" campaignId={id} label="Claim earned USDC"/>}
      <button className="secondary" onClick={()=>{refetch();refetchP()}} type="button">Refresh on-chain position</button>
    </div>}
    {isCreator&&<div className="panel stack"><h3>Creator refund</h3><p className="subtle">Only unallocated rewards or residual dust after all claims can be reclaimed; participant entitlements remain protected.</p>
      <OnchainAction kind="reclaim" campaignId={id} label="Reclaim refundable USDC"/></div>}
  </div>;
}
export function CampaignTeaser({id}:{id:bigint}){
  const {data:c}=useReadContract({address:rewardAddress,abi:rewardsAbi,functionName:"getCampaign",args:[id]});
  const {data:usdcDecimals}=useReadContract({address:addresses.usdc as Address,abi:erc20Abi,functionName:"decimals",query:{enabled:isAddress(addresses.usdc)}});
  if(!c)return null;
  return <Link className="catalog-card" href={`/campaign/${id}`}><span className="eyebrow">CAMPAIGN #{id}</span>
    <strong>Shop #{c.shopId.toString()}</strong><span className="subtle">{formatUnits(c.budget,usdcDecimals??6)} USDC funded</span>
    <span className="tiny">Ends {when(c.end)}</span></Link>;
}
export function CampaignFeed(){
  const {data:last}=useReadContract({address:rewardAddress,abi:rewardsAbi,functionName:"nextCampaignId",query:{refetchInterval:30000}});
  if(!isAddress(addresses.rewards))return <p className="subtle">Deploy the contracts and configure their addresses to enable live campaign listings.</p>;
  if(last===undefined)return <p className="subtle">Loading verified campaigns…</p>;
  const ids:bigint[]=[];for(let id=last-1n;id>=1n&&ids.length<20;id--)ids.push(id);
  if(!ids.length)return <p className="subtle">No campaigns deployed yet. A creator can fund the first from Creator Studio.</p>;
  return <div className="catalog">{ids.map(id=><CampaignTeaser key={id.toString()} id={id}/>)}</div>;
}
