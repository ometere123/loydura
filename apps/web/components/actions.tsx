"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { decodeEventLog, formatUnits, parseUnits, type Address } from "viem";
import { addresses, erc20Abi, hubAbi, isAddress, isPublicChainReady, publicConfig, rewardsAbi } from "@loydura/chain";
import { TransactionLink } from "@/components/design-system";
import { useRouter } from "next/navigation";

const hub = addresses.hub as Address;
const rewards = addresses.rewards as Address;
const usdc = addresses.usdc as Address;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export interface StudioShopOption { shopId: number; name: string; token: Address; }
function errorText(error: unknown) { return error instanceof Error ? error.message.replace(/^User rejected the request\.?/i, "Wallet signature was cancelled.").slice(0, 420) : "Transaction failed"; }
function parseBps(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const bps = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  return bps > 0n && bps <= 10_000n ? Number(bps) : null;
}

export function OnchainAction({ kind, shopId, campaignId, token, amount, label, confirm, onConfirmed }: {
  kind: "buy" | "lock" | "unlock" | "claim" | "reclaim";
  shopId?: bigint; campaignId?: bigint; token?: Address; amount?: bigint; label: string; confirm?: string; onConfirmed?: () => void;
}) {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [hash, setHash] = useState<`0x${string}`>();
  async function execute() {
    if (!isPublicChainReady) return setStatus("Public contract configuration is unavailable. Check the deployment environment.");
    if (!address || chainId !== publicConfig.chainId || !publicClient) return setStatus("Connect a wallet to Elysium Testnet first.");
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true); setStatus("Checking wallet and exact amount…"); setHash(undefined);
    try {
      if (kind === "buy" || kind === "lock") {
        const spender = kind === "buy" ? hub : rewards;
        const value = amount || 0n;
        if (!token || value <= 0n || !isAddress(spender)) throw new Error("Missing token or allowance details");
        const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [address, spender] });
        if (allowance < value) {
          setStatus("Approve the exact token amount in your wallet…");
          const approval = await writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, value] });
          const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approval });
          if (approvalReceipt.status !== "success") throw new Error("Approval reverted");
        }
      }
      setStatus("Confirm the transaction in your wallet…");
      let nextHash: `0x${string}`;
      switch (kind) {
        case "buy": nextHash = await writeContractAsync({ address: hub, abi: hubAbi, functionName: "buyMembership", args: [shopId!] }); break;
        case "lock": nextHash = await writeContractAsync({ address: rewards, abi: rewardsAbi, functionName: "lock", args: [campaignId!, amount!] }); break;
        case "unlock": nextHash = await writeContractAsync({ address: rewards, abi: rewardsAbi, functionName: "unlock", args: [campaignId!] }); break;
        case "claim": nextHash = await writeContractAsync({ address: rewards, abi: rewardsAbi, functionName: "claim", args: [campaignId!] }); break;
        case "reclaim": nextHash = await writeContractAsync({ address: rewards, abi: rewardsAbi, functionName: "reclaim", args: [campaignId!] }); break;
      }
      setHash(nextHash); setStatus("Waiting for a confirmed Elysium receipt…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: nextHash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      setStatus("Confirmed on Elysium."); onConfirmed?.(); router.refresh();
    } catch (error) { setStatus(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="action"><button className="button button-primary" type="button" disabled={busy || !address} onClick={() => void execute()}>{busy ? "Waiting…" : label}</button>{status && <p className="tiny" role="status">{status}</p>}{hash && <TransactionLink hash={hash} />}</div>;
}

export function MembershipCheckout({ shopId, token, price }: { shopId: bigint; token: Address; price: bigint }) {
  const { address } = useAccount();
  const { data: decimals } = useReadContract({ address: token, abi: erc20Abi, functionName: "decimals" });
  const { data: symbol } = useReadContract({ address: token, abi: erc20Abi, functionName: "symbol" });
  const { data: balance } = useReadContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address || ZERO_ADDRESS], query: { enabled: Boolean(address) } });
  return <div className="panel stack"><div><p className="eyebrow">MEMBERSHIP CHECKOUT</p><h3>30-day creator access</h3></div><p className="price">{formatUnits(price, decimals ?? 18)} {symbol || "tokens"}</p><p className="price-note">Payment is made directly through the deployed Hub. Renewal extends an existing expiry instead of creating a second membership.</p>{address && <p className="tiny">Wallet balance: {balance !== undefined ? `${formatUnits(balance, decimals ?? 18)} ${symbol || "tokens"}` : "Reading balance…"}</p>}<OnchainAction kind="buy" shopId={shopId} token={token} amount={price} label="Buy or renew membership" /></div>;
}

export function StakeForm({ campaignId, token, entryOpen, onConfirmed }: { campaignId: bigint; token: Address; entryOpen: boolean; onConfirmed?: () => void }) {
  const [quantity, setQuantity] = useState("100");
  const { data: decimals } = useReadContract({ address: token, abi: erc20Abi, functionName: "decimals" });
  let amount = 0n; try { if (quantity.trim() && decimals !== undefined) amount = parseUnits(quantity, decimals); } catch { amount = 0n; }
  return <div className="panel stack"><div><p className="eyebrow">ENROLLMENT</p><h3>Lock creator tokens</h3></div><label>Amount<input inputMode="decimal" min="0" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} /></label><p className="tiny">Enrollment closes at the campaign start. Rewards become claimable only after completion. Early exit returns principal but forfeits unpaid USDC.</p>{entryOpen ? <OnchainAction kind="lock" campaignId={campaignId} token={token} amount={amount} label="Lock tokens" onConfirmed={onConfirmed} /> : <p className="subtle">Enrollment has closed.</p>}</div>;
}

export function CreateShopForm({ onCreated }: { onCreated?: (shopId: number) => void }) {
  const { address, chainId } = useAccount(); const publicClient = usePublicClient(); const { writeContractAsync } = useWriteContract();
  const [token, setToken] = useState(""); const [price, setPrice] = useState("10"); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [launch, setLaunch] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false); const [createdShopId, setCreatedShopId] = useState<number>();
  const [payouts, setPayouts] = useState<{ address: string; percent: string }[]>([{ address: "", percent: "100" }]);
  async function publishProfile(shopId: number) {
    setStatus(`Publishing profile for on-chain shop #${shopId}…`);
    const result = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, name, description, ascendLaunchUrl: launch || null }) });
    const body = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(`On-chain shop #${shopId} exists. Sign in and retry profile publishing: ${body.error || "Worker rejected the profile"}`);
    setStatus(`Shop #${shopId} is live.`); onCreated?.(shopId); window.location.assign(`/shop/${shopId}`);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isPublicChainReady || !address || chainId !== publicConfig.chainId || !publicClient || !isAddress(token)) return setStatus("Connect to Elysium and enter a valid token address first.");
    setBusy(true); setStatus("");
    try {
      const decimals = await publicClient.readContract({ address: token as Address, abi: erc20Abi, functionName: "decimals" });
      const quantity = parseUnits(price, decimals); if (quantity <= 0n) throw new Error("Price must be positive");
      const parsed = payouts.map((entry, index) => ({ address: (index === 0 && !entry.address.trim() ? address : entry.address.trim()) as Address, bps: parseBps(entry.percent) }));
      if (parsed.some(entry => !isAddress(entry.address) || entry.bps === null) || parsed.reduce((sum, entry) => sum + (entry.bps || 0), 0) !== 10_000 || new Set(parsed.map(entry => entry.address.toLowerCase())).size !== parsed.length) throw new Error("Use distinct payout addresses with positive shares totaling exactly 100%.");
      setStatus("Confirm the irreversible storefront terms in your wallet…");
      const hash = await writeContractAsync({ address: hub, abi: hubAbi, functionName: "createShop", args: [token as Address, quantity, parsed.map(entry => entry.address), parsed.map(entry => entry.bps as number)] });
      setStatus("Waiting for the storefront receipt…"); const receipt = await publicClient.waitForTransactionReceipt({ hash }); if (receipt.status !== "success") throw new Error("Shop transaction reverted");
      let id: bigint | undefined;
      for (const log of receipt.logs) { try { if (log.address.toLowerCase() !== hub.toLowerCase()) continue; const decoded = decodeEventLog({ abi: hubAbi, data: log.data, topics: log.topics }); if (decoded.eventName === "ShopCreated") id = decoded.args.shopId; } catch { /* unrelated log */ } }
      if (id === undefined) throw new Error("The shop was created but its receipt did not contain a ShopCreated event. Keep this transaction and retry profile publication from the explorer.");
      const numericId = Number(id); setCreatedShopId(numericId); onCreated?.(numericId);
      try { await publishProfile(numericId); } catch (error) { setStatus(errorText(error)); }
    } catch (error) { setStatus(errorText(error)); }
    finally { setBusy(false); }
  }
  return <form className="panel stack" onSubmit={event => void submit(event)}><div><p className="eyebrow">STEP 01 / ON-CHAIN IDENTITY</p><h3>Create a creator storefront</h3><p className="subtle">Token, price, and revenue recipients become immutable on the Hub. Profile text is published separately so a Worker outage never asks you to create a second shop.</p></div><div className="form-grid"><label>Store name<input required minLength={3} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="A clear creator product name" /></label><label>Creator token address<input required placeholder="0x…" value={token} onChange={event => setToken(event.target.value)} /></label><label className="form-span">Description<textarea maxLength={1500} value={description} onChange={event => setDescription(event.target.value)} placeholder="What does a member get?" /></label><label>30-day price in token units<input required inputMode="decimal" min="0" step="any" value={price} onChange={event => setPrice(event.target.value)} /></label><label>Ascend launch URL <span className="tiny">creator-submitted, not independently verified</span><input type="url" placeholder="https://…" value={launch} onChange={event => setLaunch(event.target.value)} /></label></div><div className="stack"><strong>Revenue recipients <span className="tiny">(1–5 · 100% total)</span></strong>{payouts.map((entry, index) => <div className="list-row" key={index}><label>Recipient {index + 1}<input placeholder={index === 0 ? "Connected wallet (default)" : "0x…"} value={entry.address} onChange={event => setPayouts(current => current.map((item, i) => i === index ? { ...item, address: event.target.value } : item))} /></label><label>Share %<input inputMode="decimal" min="0.01" max="100" step="0.01" value={entry.percent} onChange={event => setPayouts(current => current.map((item, i) => i === index ? { ...item, percent: event.target.value } : item))} /></label>{payouts.length > 1 && <button className="button button-quiet button-small" type="button" onClick={() => setPayouts(current => current.filter((_, i) => i !== index))}>Remove</button>}</div>)}{payouts.length < 5 && <button className="button button-outline button-small" type="button" onClick={() => setPayouts(current => [...current, { address: "", percent: "0" }])}>Add recipient</button>}</div><button className="button button-primary" disabled={busy || Boolean(createdShopId)}>{busy ? "Creating…" : createdShopId ? `Shop #${createdShopId} created` : "Create store on Elysium"}</button>{createdShopId && <div className="notice notice-warning"><div><strong>On-chain creation succeeded.</strong><p>If the profile step failed, your shop is safe. Sign in with the creator wallet and retry publication; do not create another shop.</p><button className="button button-outline button-small" type="button" onClick={() => void publishProfile(createdShopId)} disabled={busy}>Retry profile publication</button></div></div>}{status && <p className="tiny" role="status">{status}</p>}</form>;
}

export function CreateCampaignForm({ shops, selectedShopId, onCreated }: { shops: StudioShopOption[]; selectedShopId?: number; onCreated?: (campaignId: number) => void }) {
  const { address, chainId } = useAccount(); const publicClient = usePublicClient(); const { writeContractAsync } = useWriteContract();
  const [budget, setBudget] = useState("100"); const [starts, setStarts] = useState(""); const [minutes, setMinutes] = useState("10"); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isPublicChainReady || !address || chainId !== publicConfig.chainId || !publicClient) return setStatus("Connect to Elysium Testnet first.");
    if (!selectedShopId) return setStatus("Select one of your verified storefronts first.");
    setBusy(true); setStatus("");
    try {
      if (!starts) throw new Error("Choose a start date.");
      const block = await publicClient.getBlock({ blockTag: "latest" }); const start = BigInt(Math.floor(new Date(starts).getTime() / 1000)); const duration = BigInt(minutes) * 60n;
      if (start <= block.timestamp + 30n) throw new Error("Start at least 30 seconds after the latest Elysium block."); if (duration < 60n || duration > 90n * 86400n) throw new Error("Duration must be between 1 minute and 90 days.");
      const end = start + duration; const decimals = await publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "decimals" }); if (decimals !== 6) throw new Error("Configured reward token must use six decimals.");
      const amount = parseUnits(budget, decimals); const fee = (amount + 99n) / 100n; if (amount < duration) throw new Error("Reward pool must be at least one smallest USDC unit per campaign second.");
      const allowance = await publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "allowance", args: [address, rewards] });
      if (allowance < amount + fee) { setStatus("Approve the reward pool plus the exact 1% fee…"); const approval = await writeContractAsync({ address: usdc, abi: erc20Abi, functionName: "approve", args: [rewards, amount + fee] }); const receipt = await publicClient.waitForTransactionReceipt({ hash: approval }); if (receipt.status !== "success") throw new Error("USDC approval reverted"); }
      setStatus("Confirm campaign funding in your wallet…"); const hash = await writeContractAsync({ address: rewards, abi: rewardsAbi, functionName: "createCampaign", args: [BigInt(selectedShopId), amount, start, end] }); setStatus("Waiting for the campaign receipt…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash }); if (receipt.status !== "success") throw new Error("Campaign transaction reverted");
      let id: bigint | undefined; for (const log of receipt.logs) { try { if (log.address.toLowerCase() !== rewards.toLowerCase()) continue; const decoded = decodeEventLog({ abi: rewardsAbi, data: log.data, topics: log.topics }); if (decoded.eventName === "CampaignCreated") id = decoded.args.campaignId; } catch { /* unrelated log */ } }
      if (id === undefined) throw new Error("Campaign created but its receipt did not contain a CampaignCreated event."); const numericId = Number(id); onCreated?.(numericId); window.location.assign(`/campaign/${numericId}`);
    } catch (error) { setStatus(errorText(error)); }
    finally { setBusy(false); }
  }
  return <form className="panel stack" onSubmit={event => void submit(event)}><div><p className="eyebrow">STEP 03 / FUNDED LOYALTY</p><h3>Fund a loyalty campaign</h3><p className="subtle">The creator funds the net USDC reward pool plus a 1% fee upfront. Start, end, eligibility, and settlement are fixed by the contract.</p></div>{shops.length ? <label>Verified storefront<select value={selectedShopId || ""} disabled><option value="">Select a storefront</option>{shops.map(shop => <option key={shop.shopId} value={shop.shopId}>{shop.name} · #{shop.shopId}</option>)}</select></label> : <p className="subtle">Create or load a verified storefront before funding a campaign.</p>}<div className="form-grid"><label>Net reward pool (USDC)<input required inputMode="decimal" min="0.001" step="any" value={budget} onChange={event => setBudget(event.target.value)} /></label><label>Duration (minutes)<input required type="number" min="1" max="129600" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><label className="form-span">Campaign starts in your local time<input required type="datetime-local" value={starts} onChange={event => setStarts(event.target.value)} /></label></div><div className="notice"><p><strong>Before you sign:</strong> the reward pool is committed to this campaign. Members need paid access through the end date, and early exits redistribute unpaid rewards according to the contract.</p></div><button className="button button-primary" disabled={busy || !shops.length}>{busy ? "Funding…" : "Fund campaign on Elysium"}</button>{status && <p className="tiny" role="status">{status}</p>}</form>;
}
