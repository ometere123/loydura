"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage, useChainId } from "wagmi";
import { useEffect, useState } from "react";

export function WalletBar(){return <div className="walletbar"><ConnectButton showBalance={false}/><WalletSignIn/></div>}
export function WalletSignIn(){
  const {address}=useAccount();const chainId=useChainId();const {signMessageAsync}=useSignMessage();
  const [busy,setBusy]=useState(false);const [result,setResult]=useState("");const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{setSignedIn(false);if(!address)return;fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json()).then(data=>setSignedIn(data.authenticated&&data.address?.toLowerCase()===address.toLowerCase())).catch(()=>setSignedIn(false))},[address]);
  async function signin(){
    if(!address||chainId!==99801) {setResult("Connect to Elysium Testnet first");return;}
    setBusy(true);setResult("");
    try {
      const challenge=await fetch("/api/auth/nonce",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({address})});
      const challengeJson=await challenge.json();if(!challenge.ok)throw new Error(challengeJson.error||"Challenge failed");
      const issuedAt=new Date().toISOString();
      const expirationTime=new Date(Date.now()+4*60_000).toISOString();
      const message=[
        `${window.location.host} wants you to sign in with your Ethereum account:`,
        address,
        "",
        "Sign in to Loydura to manage your creator content and memberships.",
        "",
        `URI: ${window.location.origin}`,
        "Version: 1",
        "Chain ID: 99801",
        `Nonce: ${challengeJson.nonce}`,
        `Issued At: ${issuedAt}`,
        `Expiration Time: ${expirationTime}`,
      ].join("\\n");
      const signature=await signMessageAsync({message});
      const response=await fetch("/api/auth/verify",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,signature})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Login failed");
      setSignedIn(true);setResult("Signed in — content access enabled");
    } catch(e){setResult(e instanceof Error?e.message:"Sign-in failed");}
    finally{setBusy(false);}
  }
  async function logout(){setBusy(true);try{const r=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});if(!r.ok)throw new Error("Logout failed");setSignedIn(false);setResult("Signed out")}catch(e){setResult(e instanceof Error?e.message:"Logout failed")}finally{setBusy(false)}}
  return <div className="sign-in">{signedIn?<button type="button" onClick={logout} disabled={busy} className="small-button">{busy?"Signing out…":"Sign out"}</button>:<button type="button" onClick={signin} disabled={!address||busy} className="small-button">{busy?"Signing…":"Sign in"}</button>}{result&&<span className="subtle tiny" role="status">{result}</span>}</div>;
}
