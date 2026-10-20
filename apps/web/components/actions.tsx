"use client";
import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { addresses, hubAbi, rewardsAbi, erc20Abi, isAddress } from "@loydura/chain";
import { useRouter } from "next/navigation";

const hub = addresses.hub as Address;
const rewards = addresses.rewards as Address;
const usdc = addresses.usdc as Address;
function errorText(e:unknown){return e instanceof Error ? e.message.slice(0,380) : "Transaction failed"}

export function OnchainAction({kind,shopId,campaignId,token,amount,decimals=18,label,confirm}: {
  kind:"buy"|"lock"|"unlock"|"claim"|"reclaim";
  shopId?:bigint;campaignId?:bigint;token?:Address;amount?:bigint;decimals?:number;label:string;confirm?:string;
}){
  const {address,chainId}=useAccount();const publicClient=usePublicClient();const {writeContractAsync}=useWriteContract();
  const router=useRouter();const [busy,setBusy]=useState(false);const [status,setStatus]=useState("");
  async function execute(){
    if(!address||chainId!==99801||!publicClient)return setStatus("Connect a wallet to Elysium Testnet");
    if(confirm&&!window.confirm(confirm))return;
    setBusy(true);setStatus("Checking wallet…");
    try {
      if(kind==="buy"||kind==="lock") {
        const targetToken=kind==="buy"?token:token;
        const spender=kind==="buy"?hub:rewards;
        const value=amount||0n;
        if(!targetToken||value<=0n||!isAddress(spender))throw new Error("Missing token or allowance details");
        const allowance=await publicClient.readContract({address:targetToken,abi:erc20Abi,functionName:"allowance",args:[address,spender]});
        if(allowance<value){
          setStatus("Approve exact token amount in wallet…");
          const approval=await writeContractAsync({address:targetToken,abi:erc20Abi,functionName:"approve",args:[spender,value]});
          const receipt=await publicClient.waitForTransactionReceipt({hash:approval});
          if(receipt.status!=="success")throw new Error("Approval reverted");
        }
      }
      setStatus("Confirm transaction in wallet…");
      let hash: `0x${string}`;
      switch(kind){
        case "buy":hash=await writeContractAsync({address:hub,abi:hubAbi,functionName:"buyMembership",args:[shopId!]});break;
        case "lock":hash=await writeContractAsync({address:rewards,abi:rewardsAbi,functionName:"lock",args:[campaignId!,amount!]});break;
        case "unlock":hash=await writeContractAsync({address:rewards,abi:rewardsAbi,functionName:"unlock",args:[campaignId!]});break;
        case "claim":hash=await writeContractAsync({address:rewards,abi:rewardsAbi,functionName:"claim",args:[campaignId!]});break;
        case "reclaim":hash=await writeContractAsync({address:rewards,abi:rewardsAbi,functionName:"reclaim",args:[campaignId!]});break;
      }
      setStatus(`Pending: ${hash.slice(0,12)}…`);
      const receipt=await publicClient.waitForTransactionReceipt({hash});
      if(receipt.status!=="success")throw new Error("Transaction reverted");
      setStatus(`Confirmed: ${hash}`);router.refresh();
    }catch(e){setStatus(errorText(e));}finally{setBusy(false);}
  }
  return <div className="action"><button type="button" disabled={busy||!address} onClick={execute}>{busy?"Working…":label}</button>
    {status&&<p className="tiny subtle" role="status">{status}</p>}</div>;
}

export function MembershipCheckout({shopId,token,price}:{shopId:bigint;token:Address;price:bigint}){
  const {data:decimals}=useReadContract({address:token,abi:erc20Abi,functionName:"decimals"});
  const {data:symbol}=useReadContract({address:token,abi:erc20Abi,functionName:"symbol"});
  return <div className="panel stack">
    <h3>30-day membership</h3><p className="price">{formatUnits(price,decimals??18)} {symbol||"tokens"}</p>
    <p className="subtle">Payment is final. Members receive 30 days of access. Renewal extends an existing expiry.</p>
    <OnchainAction kind="buy" shopId={shopId} token={token} amount={price} label="Buy or renew membership" />
  </div>;
}

export function StakeForm({campaignId,token,entryOpen}:{campaignId:bigint;token:Address;entryOpen:boolean}){
  const [quantity,setQuantity]=useState("100");
  const {data:decimals}=useReadContract({address:token,abi:erc20Abi,functionName:"decimals"});
  let amount=0n;try{if(Number(quantity)>0&&decimals!==undefined)amount=parseUnits(quantity,decimals)}catch{}
  return <div className="panel stack"><h3>Lock creator tokens</h3>
    <label>Amount<input type="number" min="0" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <p className="tiny subtle">Enrollment closes when the campaign begins. Rewards become claimable only at completion. Early exit returns principal but forfeits unpaid USDC.</p>
    {entryOpen?<OnchainAction kind="lock" campaignId={campaignId} token={token} amount={amount} label="Lock tokens"/>:<p className="subtle">Enrollment has closed.</p>}
  </div>;
}

export function CreateShopForm(){
  const {address,chainId}=useAccount();const publicClient=usePublicClient();const {writeContractAsync}=useWriteContract();
  const [token,setToken]=useState("");const [price,setPrice]=useState("10");const [name,setName]=useState("");
  const [description,setDescription]=useState("");const [launch,setLaunch]=useState("");const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);
  const [payouts,setPayouts]=useState<{address:string;percent:string}[]>([{address:"",percent:"100"}]);
  async function submit(e:React.FormEvent){
    e.preventDefault();if(!address||chainId!==99801||!publicClient||!isAddress(token))return setStatus("Connect to Elysium and enter a valid token address");
    setBusy(true);
    try {
      const decimals=await publicClient.readContract({address:token,abi:erc20Abi,functionName:"decimals"});
      const quantity=parseUnits(price,decimals);
      if(quantity<=0n)throw new Error("Price must be positive");
      const next=await publicClient.readContract({address:hub,abi:hubAbi,functionName:"nextShopId"});
      setStatus("Confirm on-chain shop creation…");
      const parsedPayouts=payouts.map((p,i)=>({
        address: i===0&&p.address.trim()===""?address:p.address.trim(),
        bps:Math.round(Number(p.percent)*100)
      }));
      if(parsedPayouts.some(p=>!isAddress(p.address)||!Number.isInteger(p.bps)||p.bps<1)
        ||parsedPayouts.reduce((a,p)=>a+p.bps,0)!==10000
        ||new Set(parsedPayouts.map(p=>p.address.toLowerCase())).size!==parsedPayouts.length)
        throw new Error("Enter distinct payout addresses with positive shares totaling exactly 100%");
      const hash=await writeContractAsync({address:hub,abi:hubAbi,functionName:"createShop",args:[token,quantity,parsedPayouts.map(p=>p.address as Address),parsedPayouts.map(p=>p.bps)]});
      const receipt=await publicClient.waitForTransactionReceipt({hash});if(receipt.status!=="success")throw new Error("Shop transaction reverted");
      // Read ShopCreated from THIS receipt: never rely on a potentially stale nextShopId.
      const {decodeEventLog}=await import("viem");
      let id:bigint|undefined;
      for(const log of receipt.logs){try{if(log.address.toLowerCase()!==hub.toLowerCase())continue;
        const decoded=decodeEventLog({abi:hubAbi,data:log.data,topics:log.topics});
        const event=decoded as {eventName?:string;args?:{shopId?:bigint}};
        if(event.eventName==="ShopCreated"&&event.args?.shopId!==undefined)id=event.args.shopId;
      }catch{}}
      if(id===undefined||id<next)throw new Error("Shop created but event could not be resolved; find shop ID on explorer");
      setStatus(`Shop ${id} created. Publishing details…`);
      const result=await fetch("/api/shop",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({shopId:Number(id),name,description,ascendLaunchUrl:launch})});
      if(!result.ok){const j=await result.json();throw new Error(`On-chain shop #${id} created. Sign in and retry profile publishing: ${j.error}`)}
      window.location.assign(`/shop/${id}`);
    }catch(err){setStatus(errorText(err))}finally{setBusy(false)}
  }
  return <form className="panel stack" onSubmit={submit}><h3>Create creator storefront</h3>
    <p className="subtle">Sign in using the wallet bar. Token, price and revenue recipient shares are immutable after on-chain creation.</p>
    <label>Store name<input required minLength={3} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Description<textarea maxLength={1500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <label>Creator token address<input required placeholder="0x…" value={token} onChange={e=>setToken(e.target.value)}/></label>
    <label>30-day price in token units<input required type="number" min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)}/></label>
    <label>Ascend launch URL (creator-supplied)<input type="url" placeholder="https://…" value={launch} onChange={e=>setLaunch(e.target.value)}/></label>
    <div className="stack"><strong>Revenue recipients (1–5, 100% total)</strong>
    {payouts.map((p,i)=><div key={i} className="list-row"><label style={{flex:1}}>Recipient {i+1} address
      <input placeholder={i===0?"Connected wallet (default)":"0x…"} value={p.address}
        onChange={e=>setPayouts(s=>s.map((x,j)=>j===i?{...x,address:e.target.value}:x))}/></label>
      <label style={{width:100}}>Share %<input required type="number" min="0.01" max="100" step="0.01" value={p.percent}
        onChange={e=>setPayouts(s=>s.map((x,j)=>j===i?{...x,percent:e.target.value}:x))}/></label>
      {payouts.length>1&&<button className="small-button" type="button" onClick={()=>setPayouts(s=>s.filter((_,j)=>j!==i))}>Remove</button>}</div>)}
    {payouts.length<5&&<button className="secondary" type="button" onClick={()=>setPayouts(s=>[...s,{address:"",percent:"0"}])}>Add recipient</button>}
    </div>
    <button disabled={busy}>{busy?"Creating…":"Create store on Elysium"}</button>{status&&<p role="status" className="subtle tiny">{status}</p>}
  </form>;
}

export function CreateCampaignForm(){
  const {address,chainId}=useAccount();const publicClient=usePublicClient();const {writeContractAsync}=useWriteContract();
  const [shopId,setShopId]=useState("");const [budget,setBudget]=useState("100");
  const [starts,setStarts]=useState("");const [minutes,setMinutes]=useState("10");
  const [busy,setBusy]=useState(false);const [status,setStatus]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();if(!address||chainId!==99801||!publicClient)return setStatus("Connect to Elysium Testnet");
    setBusy(true);
    try{
      if(!/^\d+$/.test(shopId)||Number(shopId)<1)throw new Error("Invalid shop ID");
      if(!starts)throw new Error("Choose a start date");
      const start=BigInt(Math.floor(new Date(starts).getTime()/1000));
      const duration=Number(minutes)*60;
      if(!Number.isSafeInteger(duration)||duration<60||duration>90*86400)throw new Error("Duration must be 1 minute to 90 days");
      const end=start+BigInt(duration);
      if(start<=BigInt(Math.floor(Date.now()/1000)+30))throw new Error("Start at least 30 seconds in the future");
      const decimals=await publicClient.readContract({address:usdc,abi:erc20Abi,functionName:"decimals"});
      if(decimals!==6)throw new Error("Configured demo USDC must use six decimals");
      const amount=parseUnits(budget,decimals);
      const fee=(amount+99n)/100n;
      if(amount<BigInt(duration))throw new Error("Reward pool too small for duration");
      const allowance=await publicClient.readContract({address:usdc,abi:erc20Abi,functionName:"allowance",args:[address,rewards]});
      if(allowance<amount+fee){setStatus("Approve USDC campaign pool and 1% fee…");
        const hash=await writeContractAsync({address:usdc,abi:erc20Abi,functionName:"approve",args:[rewards,amount+fee]});
        const r=await publicClient.waitForTransactionReceipt({hash});if(r.status!=="success")throw new Error("USDC approval reverted");}
      setStatus("Confirm campaign creation…");
      const hash=await writeContractAsync({address:rewards,abi:rewardsAbi,functionName:"createCampaign",args:[BigInt(shopId),amount,start,end]});
      const receipt=await publicClient.waitForTransactionReceipt({hash});if(receipt.status!=="success")throw new Error("Campaign transaction reverted");
      const {decodeEventLog}=await import("viem");let id:bigint|undefined;
      for(const log of receipt.logs){try{if(log.address.toLowerCase()!==rewards.toLowerCase())continue;
        const ev=decodeEventLog({abi:rewardsAbi,topics:log.topics,data:log.data});
        const event=ev as {eventName?:string;args?:{campaignId?:bigint}};
        if(event.eventName==="CampaignCreated"&&event.args?.campaignId!==undefined)id=event.args.campaignId;
      }catch{}}
      if(id===undefined)throw new Error("Campaign created but event cannot be parsed; inspect explorer receipt");
      window.location.assign(`/campaign/${id}`);
    }catch(err){setStatus(errorText(err))}finally{setBusy(false)}
  }
  return <form className="panel stack" onSubmit={submit}><h3>Fund loyalty campaign</h3>
    <p className="subtle">Creators pay the full USDC reward budget plus 1% service fee. Members must purchase access extending past campaign end to enroll.</p>
    <label>Existing on-chain shop ID<input required type="number" min="1" step="1" value={shopId} onChange={e=>setShopId(e.target.value)}/></label>
    <label>Net reward pool (USDC)<input required type="number" min="0.001" step="any" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
    <label>Campaign starts (your local time)<input required type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)}/></label>
    <label>Duration in minutes (max 129600)<input required type="number" min="1" max="129600" step="1" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
    <button disabled={busy}>{busy?"Creating…":"Fund campaign on Elysium"}</button>{status&&<p className="subtle tiny" role="status">{status}</p>}
  </form>;
}
