"use client";

import { FileDown, LockKeyhole, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/design-system";

type ContentInfo = { id: string; shop_id: number; title: string; kind: "post" | "download"; filename?: string | null; created_at: string };
type ShopOption = { shopId: number; name: string };

function apiError(body: unknown, fallback: string) {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : fallback;
}

export function MemberContent({ shopId }: { shopId: number }) {
  const { address } = useAccount();
  const [items, setItems] = useState<ContentInfo[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!address) return;
    setBusy(true); setStatus("Checking signed-in membership against Elysium…");
    try {
      const response = await fetch(`/api/content?shopId=${shopId}`, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Unable to load member content"));
      setItems(Array.isArray(body.content) ? body.content : []); setLoaded(true); setStatus("");
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Unable to load member content"); }
    finally { setBusy(false); }
  }

  async function view(item: ContentInfo) {
    setBusy(true); setStatus("Verifying current on-chain access…"); setSelected("");
    try {
      const endpoint = item.kind === "download" ? `/api/content/${item.id}/download` : `/api/content/${item.id}`;
      const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(apiError(await response.json().catch(() => ({})), "Access denied"));
      if (item.kind === "download") {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a"); anchor.href = objectUrl;
        const disposition = response.headers.get("Content-Disposition") || "";
        const match = /filename="([^"]+)"/i.exec(disposition);
        anchor.download = match?.[1] || item.filename || item.title;
        document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl);
      } else {
        const body = await response.json(); setSelected(body.content?.body || "");
      }
      setStatus("");
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Content unavailable"); }
    finally { setBusy(false); }
  }

  return <section className="panel stack"><div className="section-inline"><div><p className="eyebrow">MEMBER LIBRARY</p><h3>Protected content</h3></div><LockKeyhole size={18} aria-hidden="true" /></div>
    <p className="subtle">Access is checked against your session and the live membership expiry. A database row never grants access by itself.</p>
    {!address ? <EmptyState icon={<LockKeyhole size={23} />} title="Connect and sign in to check access." description="The creator’s content remains private until the Worker verifies your wallet and current membership." /> : <><button className="button button-outline button-small" type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={14} className={busy ? "spin" : ""} aria-hidden="true" /> {busy ? "Checking…" : loaded ? "Refresh member access" : "Check membership & load content"}</button>{status && <p className="tiny" role="status">{status}</p>}{loaded && !items.length && <EmptyState title="No member content published yet." description="The creator has not released a protected post or file for this storefront." />}{items.map((item) => <div className="list-row" key={item.id}><div><strong>{item.title}</strong><p className="tiny subtle">{item.kind === "download" ? "Private file" : "Member post"} · {new Date(item.created_at).toLocaleDateString()}</p></div><button className="button button-quiet button-small" type="button" onClick={() => void view(item)} disabled={busy}>{item.kind === "download" ? <><FileDown size={14} aria-hidden="true" />Download</> : "Read"}</button></div>)}{selected && <article className="protected-content"><p className="eyebrow">MEMBER POST</p><p>{selected}</p></article>}</>}
  </section>;
}

export function ContentEditor({ shops, selectedShopId, onSelectShop, onPublished }: { shops: ShopOption[]; selectedShopId?: number; onSelectShop?: (shopId: number) => void; onPublished?: () => void }) {
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      if (!selectedShopId) throw new Error("Select one of your verified storefronts first.");
      if (file && file.size > 12 * 1024 * 1024) throw new Error("Files must be 12 MB or smaller.");
      const form = new FormData(); form.set("shopId", String(selectedShopId)); form.set("title", title); form.set("body", body); if (file) form.set("file", file);
      const response = await fetch("/api/content", { method: "POST", body: form, credentials: "same-origin" });
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(result, "Failed to publish content"));
      setStatus(`Published ${result.content?.id || "content"}.`); setTitle(""); setBody(""); setFile(null); onPublished?.();
      const input = document.getElementById("content-file") as HTMLInputElement | null; if (input) input.value = "";
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Unable to publish"); }
    finally { setBusy(false); }
  }
  return <form className="panel stack" onSubmit={(event) => void submit(event)}><div className="section-inline"><div><p className="eyebrow">PUBLISH</p><h3>Member-only content</h3></div><StatusBadge tone="accent">Private by default</StatusBadge></div>
    <p className="subtle">Text posts stay in Supabase metadata; PDF, PNG, JPEG, and TXT files stay in the private R2 bucket. Sign in with the verified creator wallet before publishing.</p>
    {shops.length ? <label>Verified storefront<select value={selectedShopId || ""} onChange={(event) => onSelectShop?.(Number(event.target.value))} disabled={!onSelectShop}><option value="">Select a storefront</option>{shops.map((shop) => <option value={shop.shopId} key={shop.shopId}>{shop.name} · #{shop.shopId}</option>)}</select></label> : <EmptyState title="Create a storefront first." description="Protected content must belong to a verified on-chain shop." />}
    <label>Title<input required minLength={3} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A useful member resource" /></label>
    <label>Member post<textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a text post, or choose a file below." maxLength={15000} /></label>
    <label>Private file <span className="tiny">PDF, PNG, JPEG, or TXT · 12 MB maximum</span><input id="content-file" type="file" accept="application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
    <button className="button button-primary" type="submit" disabled={busy || !shops.length || !selectedShopId || (!file && !body.trim())}>{busy ? "Publishing…" : "Publish protected content"}</button>{status && <p className="tiny" role="status">{status}</p>}
  </form>;
}

export function CreatorContentList({ shopId, refreshKey = 0 }: { shopId: number; refreshKey?: number }) {
  const [items, setItems] = useState<ContentInfo[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [deleting, setDeleting] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch(`/api/content?shopId=${shopId}`, { cache: "no-store", credentials: "same-origin" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Sign in to review creator content")); setItems(Array.isArray(body.content) ? body.content : []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Content could not be loaded"); }
    finally { setLoading(false); }
  }, [shopId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  async function remove(item: ContentInfo) {
    if (!window.confirm(`Delete “${item.title}” permanently?`)) return;
    setDeleting(item.id); setError("");
    try { const response = await fetch(`/api/content/${item.id}`, { method: "DELETE", credentials: "same-origin" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Could not delete content")); setItems((current) => current.filter((entry) => entry.id !== item.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete content"); }
    finally { setDeleting(""); }
  }
  return <section className="panel stack"><div className="section-inline"><div><p className="eyebrow">PUBLICATION LOG</p><h3>Current shop content</h3></div><button className="button button-quiet button-small" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Refresh</button></div>{loading ? <LoadingState label="Reading creator content…" /> : error ? <ErrorState description={error} onRetry={() => void load()} /> : !items.length ? <EmptyState icon={<LockKeyhole size={23} />} title="Nothing published yet." description="Your first post or private file will appear here after the Worker confirms it." /> : <div className="studio-content-list">{items.map((item) => <div className="list-row" key={item.id}><div><strong>{item.title}</strong><p className="tiny subtle">{item.kind === "download" ? item.filename || "Private file" : "Member post"} · {new Date(item.created_at).toLocaleDateString()}</p></div><button className="button button-danger button-small" type="button" onClick={() => void remove(item)} disabled={deleting === item.id}><Trash2 size={14} aria-hidden="true" />{deleting === item.id ? "Deleting…" : "Delete"}</button></div>)}</div>}</section>;
}
