"use client";
import { useState } from "react";
import { useAccount } from "wagmi";

interface ContentInfo {id:string;title:string;kind:"post"|"download";created_at:string}
export function MemberContent({shopId}:{shopId:number}){
  const {address}=useAccount();const [items,setItems]=useState<ContentInfo[]>([]);
  const [selected,setSelected]=useState("");const [status,setStatus]=useState("");const [loaded,setLoaded]=useState(false);
  async function load(){setStatus("Checking signed-in membership against Elysium…");
    try{const r=await fetch(`/api/content?shopId=${shopId}`,{cache:"no-store"});const j=await r.json();
      if(!r.ok)throw Error(j.error||"Unable to load");setItems(j.content);setLoaded(true);setStatus("");
    }catch(e){setStatus(e instanceof Error?e.message:"Unable to load");}}
  async function view(item:ContentInfo){setStatus("Verifying access…");setSelected("");
    try{const url=item.kind==="download"?`/api/content/${item.id}/download`:`/api/content/${item.id}`;
      const r=await fetch(url,{cache:"no-store",credentials:"same-origin"});
      if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||"Denied")}
      if(item.kind==="download"){
        const blob=await r.blob();const objectUrl=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=objectUrl;const disposition=r.headers.get("Content-Disposition")||"";const match=/filename=\"([^\"]+)\"/i.exec(disposition);anchor.download=match?.[1]||item.title;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(objectUrl);
      } else {const j=await r.json();setSelected(j.content.body||"");}setStatus("");
    }catch(e){setStatus(e instanceof Error?e.message:"Unavailable");}}
  return <section className="panel stack"><h3>Member library</h3>
    <p className="subtle">Sign in using the wallet bar after purchase. Access is checked live on chain, not by a database subscription flag.</p>
    <button type="button" onClick={load} disabled={!address}>Check membership & load content</button>
    {status&&<p className="tiny subtle" role="status">{status}</p>}
    {loaded&&items.length===0&&<p className="subtle">No member content published yet.</p>}
    {items.map(x=><div className="list-row" key={x.id}><div><strong>{x.title}</strong><p className="tiny subtle">{x.kind} · {new Date(x.created_at).toLocaleDateString()}</p></div><button className="small-button" type="button" onClick={()=>view(x)}>{x.kind==="download"?"Download":"Read"}</button></div>)}
    {selected&&<article className="protected-content"><p style={{whiteSpace:"pre-wrap"}}>{selected}</p></article>}
  </section>;
}

export function ContentEditor(){
  const [shopId,setShopId]=useState("");const [title,setTitle]=useState("");const [body,setBody]=useState("");
  const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [status,setStatus]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setStatus("");
    try{if(file&&file.size>12*1024*1024)throw Error("Files must be 12 MB or smaller");const fd=new FormData();fd.set("shopId",shopId);fd.set("title",title);fd.set("body",body);
      if(file)fd.set("file",file);
      const r=await fetch("/api/content",{method:"POST",body:fd});const j=await r.json();
      if(!r.ok)throw Error(j.error||"Failed to publish");setStatus(`Published ${j.content.id}`);setTitle("");setBody("");setFile(null);
    }catch(e){setStatus(e instanceof Error?e.message:"Unable to publish");}finally{setBusy(false)}}
  return <form className="panel stack" onSubmit={submit}><h3>Publish member-only content</h3>
    <p className="subtle">Sign in as the on-chain shop creator first. Text posts are stored in Supabase; PDF, text and image downloads stay private in Cloudflare R2.</p>
    <label>Shop ID<input required type="number" min="1" value={shopId} onChange={e=>setShopId(e.target.value)}/></label>
    <label>Title<input required minLength={3} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Member post<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write access-controlled content" maxLength={15000} /></label>
    <label>Or upload a protected file (PDF/PNG/JPEG/TXT, 12 MB max)<input type="file" accept="application/pdf,image/png,image/jpeg,text/plain" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <button disabled={busy||(!file&&!body.trim())}>{busy?"Publishing…":"Publish to shop"}</button>
    {status&&<p className="tiny subtle" role="status">{status}</p>}
  </form>;
}
