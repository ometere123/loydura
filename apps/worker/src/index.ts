import { Hono } from "hono";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicClient,
  http,
  isAddress as isViemAddress,
  type Address,
  type PublicClient
} from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { hubAbi } from "@loydura/chain";
import { z } from "zod";

const CHAIN_ID = 99801;
const SESSION_MAX_AGE = 24 * 60 * 60;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const nonceSchema = z.object({ address: z.string().trim() });
const shopSchema = z.object({
  shopId: z.number().int().positive().safe(),
  name: z.string().trim().min(3).max(80),
  description: z.string().max(1500).default(""),
  ascendLaunchUrl: z.string().url().max(2048).optional().nullable()
});
const uuidSchema = z.string().uuid();

type Session = { tokenHash: string; walletAddress: Address; expiresAt: string };
type Shop = { creator: Address; token: Address; price: bigint; exists: boolean };
type ContentRow = {
  id: string;
  shop_id: number;
  creator_address: string;
  title: string;
  kind: "post" | "download";
  body: string | null;
  storage_key: string | null;
  filename: string | null;
  created_at: string;
};

class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const app = new Hono<{ Bindings: Env; Variables: { session: Session } }>();

function jsonError(error: unknown): { status: number; message: string } {
  if (error instanceof ApiError) return { status: error.status, message: error.message };
  return { status: 500, message: "Internal server error" };
}

function requireConfig(env: Env, keys: (keyof Env)[]): void {
  for (const key of keys) {
    const value = env[key];
    if (typeof value !== "string" || value.trim() === "") throw new ApiError(503, "Service is not configured");
  }
}

function database(env: Env): SupabaseClient {
  requireConfig(env, ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function chainClient(env: Env): PublicClient {
  requireConfig(env, ["ELYSIUM_RPC_URL"]);
  const client = createPublicClient({
    chain: {
      id: CHAIN_ID,
      name: "Elysium Testnet",
      nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
      rpcUrls: { default: { http: [env.ELYSIUM_RPC_URL] } },
      testnet: true
    },
    transport: http(env.ELYSIUM_RPC_URL)
  } as any);
  return client as unknown as PublicClient;
}

function configuredAddress(value: string, label: string): Address {
  if (!isViemAddress(value)) throw new ApiError(503, `${label} is not configured`);
  return value as Address;
}

function hubAddress(env: Env): Address { return configuredAddress(env.LOYDURA_HUB_ADDRESS, "Hub address"); }

function originIsAllowed(env: Env, request: Request): boolean {
  return request.headers.get("Origin") === env.APP_ORIGIN;
}

function requireBrowserOrigin(env: Env, request: Request): void {
  requireConfig(env, ["APP_ORIGIN"]);
  if (!originIsAllowed(env, request)) throw new ApiError(403, "Origin is required and not allowed");
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function randomHex(byteLength: number): Promise<string> {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function parseCookies(request: Request): Record<string, string> {
  const raw = request.headers.get("Cookie") || "";
  return Object.fromEntries(raw.split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function sessionCookie(token: string, env: Env, maxAge = SESSION_MAX_AGE): string {
  const secure = env.APP_ORIGIN.startsWith("https://") ? "; Secure" : "";
  return `loydura_session=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function addCookie(response: Response, value: string): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function currentSession(env: Env, request: Request): Promise<Session | null> {
  const token = parseCookies(request).loydura_session;
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return null;
  const tokenHash = await sha256(token);
  const db = database(env);
  const result = await db.from("app_sessions").select("token_hash,wallet_address,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (result.error) throw new ApiError(503, "Session store unavailable");
  if (!result.data) return null;
  if (Date.parse(result.data.expires_at) <= Date.now()) {
    await db.from("app_sessions").delete().eq("token_hash", tokenHash);
    return null;
  }
  return { tokenHash, walletAddress: result.data.wallet_address as Address, expiresAt: result.data.expires_at };
}

async function requireSession(c: { env: Env; req: { raw: Request }; set: (key: "session", value: Session) => void }): Promise<Session> {
  const session = await currentSession(c.env, c.req.raw);
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  c.set("session", session);
  return session;
}

async function rateLimit(env: Env, request: Request, name: string, limit: number, windowSeconds: number): Promise<void> {
  const db = database(env);
  const key = await sha256(`${name}:${clientIp(request)}`);
  const result = await db.rpc("consume_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (result.error) throw new ApiError(503, "Rate-limit store unavailable");
  if (result.data !== true) throw new ApiError(429, "Too many requests; try again later");
}

async function jsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiError(400, "Invalid JSON body"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "Request body is invalid");
  return parsed.data;
}

async function readShop(env: Env, shopId: bigint): Promise<Shop> {
  const client = chainClient(env);
  try {
    const shop = await client.readContract({ address: hubAddress(env), abi: hubAbi, functionName: "getShop", args: [shopId] });
    return shop as Shop;
  } catch { throw new ApiError(404, "Shop not found on chain"); }
}

async function isCreator(env: Env, shopId: bigint, wallet: Address): Promise<{ shop: Shop; allowed: boolean }> {
  const shop = await readShop(env, shopId);
  return { shop, allowed: shop.creator.toLowerCase() === wallet.toLowerCase() };
}

async function hasMembership(env: Env, shopId: bigint, wallet: Address): Promise<boolean> {
  const shop = await readShop(env, shopId);
  const client = chainClient(env);
  const [expiry, block] = await Promise.all([
    client.readContract({ address: hubAddress(env), abi: hubAbi, functionName: "membershipExpires", args: [shopId, wallet] }),
    client.getBlock({ blockTag: "latest" })
  ]);
  return (expiry as bigint) > block.timestamp || shop.creator.toLowerCase() === wallet.toLowerCase();
}

function normalizeAddress(value: string, label: string): Address {
  if (!isViemAddress(value)) throw new ApiError(400, `${label} must be a valid address`);
  return value.toLowerCase() as Address;
}

export function safeFilename(value: string): string {
  const cleaned = value.normalize("NFKC").replace(/[\\/\r\n\0\u2028\u2029]/g, "_").replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/^\.+/, "_").trim();
  return (cleaned || "download").slice(0, 180);
}

export function detectFile(contentType: string, bytes: Uint8Array): string | null {
  if (contentType === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (contentType === "image/png" && bytes.length >= 8 && bytes.slice(0, 8).every((byte, i) => byte === [137,80,78,71,13,10,26,10][i])) return "image/png";
  if (contentType === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (contentType === "text/plain" && !bytes.includes(0)) return "text/plain";
  return null;
}

function contentHeaders(env: Env, origin: string | null | undefined): Headers {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (origin === env.APP_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  return headers;
}

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin && origin !== c.env.APP_ORIGIN) throw new ApiError(403, "Origin is not allowed");
  if (c.req.method === "OPTIONS") {
    if (!originIsAllowed(c.env, c.req.raw)) throw new ApiError(403, "Origin is not allowed");
    const response = new Response(null, { status: 204, headers: contentHeaders(c.env, origin) });
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return response;
  }
  await next();
  if (origin === c.env.APP_ORIGIN) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
});

app.get("/health", async (c) => {
  const checks = { config: true, database: false, r2: false, rpc: false, contracts: false };
  try { requireConfig(c.env, ["APP_ORIGIN", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "ELYSIUM_RPC_URL", "LOYDURA_HUB_ADDRESS", "LOYDURA_REWARDS_ADDRESS", "LOYDURA_USDC_ADDRESS"]); configuredAddress(c.env.LOYDURA_HUB_ADDRESS, "Hub address"); configuredAddress(c.env.LOYDURA_REWARDS_ADDRESS, "Rewards address"); configuredAddress(c.env.LOYDURA_USDC_ADDRESS, "USDC address"); } catch { checks.config = false; }
  if (checks.config) {
    try { const result = await database(c.env).from("shop_profiles").select("shop_id").limit(1); checks.database = !result.error; } catch { checks.database = false; }
    try { await c.env.LOYDURA_R2.head("__loydura_health_probe__"); checks.r2 = true; } catch { checks.r2 = false; }
    try { checks.rpc = (await chainClient(c.env).getChainId()) === CHAIN_ID; } catch { checks.rpc = false; }
    try {
      const client = chainClient(c.env);
      const code = await Promise.all([
        client.getCode({ address: configuredAddress(c.env.LOYDURA_HUB_ADDRESS, "Hub address") }),
        client.getCode({ address: configuredAddress(c.env.LOYDURA_REWARDS_ADDRESS, "Rewards address") }),
        client.getCode({ address: configuredAddress(c.env.LOYDURA_USDC_ADDRESS, "USDC address") })
      ]);
      checks.contracts = code.every((value) => !!value && value !== "0x");
    } catch { checks.contracts = false; }
  }
  const ready = Object.values(checks).every(Boolean);
  return c.json({ status: ready ? "ok" : "degraded", checks }, ready ? 200 : 503);
});

app.post("/api/auth/nonce", async (c) => {
  requireBrowserOrigin(c.env, c.req.raw);
  await rateLimit(c.env, c.req.raw, "nonce", 10, 300);
  const { address } = await jsonBody(c.req.raw, nonceSchema);
  const walletAddress = normalizeAddress(address, "address");
  const nonce = await randomHex(16);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const result = await database(c.env).from("siwe_nonces").insert({ nonce, wallet_address: walletAddress, chain_id: CHAIN_ID, expires_at: expiresAt });
  if (result.error) throw new ApiError(503, "Could not issue sign-in nonce");
  return noStore(c.json({ nonce, expiresAt }));
});

app.post("/api/auth/verify", async (c) => {
  requireBrowserOrigin(c.env, c.req.raw);
  await rateLimit(c.env, c.req.raw, "verify", 10, 300);
  const body = await jsonBody(c.req.raw, z.object({ message: z.string().min(1).max(4096), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }));
  let parsed: ReturnType<typeof parseSiweMessage>;
  try {
    parsed = parseSiweMessage(body.message);
  } catch {
    throw new ApiError(401, "Invalid sign-in message");
  }
  const appOrigin = new URL(c.env.APP_ORIGIN);
  if (!parsed.address || !parsed.domain || !parsed.uri || parsed.chainId !== CHAIN_ID || parsed.version !== "1" || parsed.domain !== appOrigin.host || parsed.uri !== c.env.APP_ORIGIN || !parsed.nonce || !/^[0-9a-f]{32}$/i.test(parsed.nonce) || !parsed.issuedAt || !parsed.expirationTime) throw new ApiError(401, "Invalid sign-in message");
  const now = new Date();
  if (!validateSiweMessage({ message: parsed, address: parsed.address, domain: appOrigin.host, nonce: parsed.nonce, time: now }) || now.getTime() - parsed.issuedAt.getTime() > 5 * 60_000 || parsed.issuedAt.getTime() > now.getTime() + 30_000 || parsed.expirationTime.getTime() - now.getTime() > 6 * 60_000) throw new ApiError(401, "Expired or invalid sign-in message");
  const walletAddress = normalizeAddress(parsed.address, "address");
  let signatureValid = false;
  try { signatureValid = await chainClient(c.env).verifyMessage({ address: walletAddress, message: body.message, signature: body.signature as `0x${string}` }); } catch { signatureValid = false; }
  if (!signatureValid) throw new ApiError(401, "Wallet signature is invalid");
  const db = database(c.env);
  const nonceResult = await db.rpc("consume_siwe_nonce", { p_nonce: parsed.nonce, p_address: walletAddress, p_chain_id: CHAIN_ID });
  if (nonceResult.error || nonceResult.data !== true) throw new ApiError(401, "Nonce is invalid or already used");
  const token = await randomHex(32);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  const sessionResult = await db.from("app_sessions").insert({ token_hash: tokenHash, wallet_address: walletAddress, expires_at: expiresAt });
  if (sessionResult.error) throw new ApiError(503, "Could not create session");
  const response = noStore(c.json({ address: walletAddress, expiresAt }));
  return addCookie(response, sessionCookie(token, c.env));
});

app.get("/api/auth/session", async (c) => {
  const session = await currentSession(c.env, c.req.raw);
  return noStore(c.json({ authenticated: !!session, address: session?.walletAddress || null, expiresAt: session?.expiresAt || null }));
});

app.post("/api/auth/logout", async (c) => {
  requireBrowserOrigin(c.env, c.req.raw);
  const token = parseCookies(c.req.raw).loydura_session;
  if (token && /^[0-9a-f]{64}$/i.test(token)) await database(c.env).from("app_sessions").delete().eq("token_hash", await sha256(token));
  return addCookie(noStore(c.json({ ok: true })), sessionCookie("", c.env, 0));
});

app.get("/api/shop", async (c) => {
  const shopParam = c.req.query("shopId");
  if (shopParam !== undefined) {
    if (!/^\d{1,15}$/.test(shopParam) || Number(shopParam) < 1) throw new ApiError(400, "Invalid shop ID");
    const shop = await readShop(c.env, BigInt(shopParam));
    const result = await database(c.env).from("shop_profiles").select("shop_id,name,description,token_address,creator_address,ascend_launch_url,created_at").eq("shop_id", Number(shopParam)).maybeSingle();
    if (result.error) throw new ApiError(503, "Shop directory unavailable");
    return c.json({ onchain: { creator: shop.creator, token: shop.token, price: shop.price.toString() }, profile: result.data || null });
  }
  const session = c.req.query("mine") === "1" ? await requireSession(c) : null;
  const query = database(c.env).from("shop_profiles").select("shop_id,name,description,token_address,creator_address,ascend_launch_url,created_at").order("created_at", { ascending: false }).limit(30);
  const result = session ? await query.eq("creator_address", session.walletAddress.toLowerCase()) : await query;
  if (result.error) throw new ApiError(503, "Shop directory unavailable");
  if (!session) return c.json({ shops: result.data || [] });
  const verified = [];
  for (const profile of result.data || []) { const checked = await isCreator(c.env, BigInt(profile.shop_id), session.walletAddress); if (checked.allowed) verified.push(profile); }
  return c.json({ shops: verified });
});

app.post("/api/shop", async (c) => {
  requireBrowserOrigin(c.env, c.req.raw);
  await rateLimit(c.env, c.req.raw, "shop-write", 20, 600);
  const session = await requireSession(c);
  const body = await jsonBody(c.req.raw, shopSchema);
  const checked = await isCreator(c.env, BigInt(body.shopId), session.walletAddress);
  if (!checked.allowed) throw new ApiError(403, "Only the on-chain shop creator can edit this profile");
  const result = await database(c.env).from("shop_profiles").upsert({ shop_id: body.shopId, creator_address: checked.shop.creator.toLowerCase(), token_address: checked.shop.token.toLowerCase(), name: body.name, description: body.description, ascend_launch_url: body.ascendLaunchUrl || null }, { onConflict: "shop_id" }).select().single();
  if (result.error) throw new ApiError(503, "Could not save shop profile");
  return c.json({ shop: result.data });
});

async function contentRow(env: Env, id: string): Promise<ContentRow> {
  if (!uuidSchema.safeParse(id).success) throw new ApiError(400, "Invalid content ID");
  const result = await database(env).from("shop_content").select("id,shop_id,creator_address,title,kind,body,storage_key,filename,created_at").eq("id", id).maybeSingle();
  if (result.error) throw new ApiError(503, "Content store unavailable");
  if (!result.data) throw new ApiError(404, "Content not found");
  return result.data as ContentRow;
}

async function requireContentAccess(c: { env: Env; req: { raw: Request } }, shopId: number): Promise<Session> {
  const session = await currentSession(c.env, c.req.raw);
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (!(await hasMembership(c.env, BigInt(shopId), session.walletAddress))) throw new ApiError(403, "Active on-chain membership is required");
  return session;
}

app.get("/api/content", async (c) => {
  const shopId = c.req.query("shopId");
  if (!shopId || !/^\d{1,15}$/.test(shopId) || Number(shopId) < 1) throw new ApiError(400, "Invalid shop ID");
  await requireContentAccess(c, Number(shopId));
  const result = await database(c.env).from("shop_content").select("id,shop_id,title,kind,filename,created_at").eq("shop_id", Number(shopId)).order("created_at", { ascending: false });
  if (result.error) throw new ApiError(503, "Content store unavailable");
  return noStore(c.json({ content: result.data || [] }));
});

app.get("/api/content/:id", async (c) => {
  const row = await contentRow(c.env, c.req.param("id"));
  await requireContentAccess(c, row.shop_id);
  if (row.kind !== "post") throw new ApiError(400, "This content is a file download");
  return noStore(c.json({ content: { id: row.id, title: row.title, kind: row.kind, body: row.body, created_at: row.created_at } }));
});

app.get("/api/content/:id/download", async (c) => {
  const row = await contentRow(c.env, c.req.param("id"));
  await requireContentAccess(c, row.shop_id);
  if (row.kind !== "download" || !row.storage_key || !row.filename) throw new ApiError(404, "File not found");
  const object = await c.env.LOYDURA_R2.get(row.storage_key);
  if (!object) throw new ApiError(404, "File not found");
  const headers = contentHeaders(c.env, c.req.header("Origin"));
  headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Content-Length", String(object.size));
  headers.set("Content-Disposition", `attachment; filename="${safeFilename(row.filename)}"`);
  return new Response(object.body, { status: 200, headers });
});

app.post("/api/content", async (c) => {
  requireBrowserOrigin(c.env, c.req.raw);
  await rateLimit(c.env, c.req.raw, "content-write", 20, 600);
  const length = Number(c.req.header("Content-Length") || 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new ApiError(413, "Upload is too large");
  const session = await requireSession(c);
  let form: FormData;
  try { form = await c.req.raw.formData(); } catch { throw new ApiError(400, "Invalid multipart form"); }
  const shopId = Number(form.get("shopId"));
  const title = String(form.get("title") || "").trim();
  const body = String(form.get("body") || "").trim();
  if (!Number.isSafeInteger(shopId) || shopId < 1 || title.length < 3 || title.length > 140) throw new ApiError(400, "Invalid content details");
  const checked = await isCreator(c.env, BigInt(shopId), session.walletAddress);
  if (!checked.allowed) throw new ApiError(403, "Only the on-chain shop creator can publish content");
  const uploaded = form.get("file") instanceof File && (form.get("file") as File).size > 0 ? form.get("file") as File : null;
  const hasFile = uploaded !== null;
  if (hasFile && body) throw new ApiError(400, "Choose either a text post or a file");
  if (!hasFile && !body) throw new ApiError(400, "Content body or file is required");
  let storageKey: string | null = null;
  let filename: string | null = null;
  let kind: "post" | "download" = "post";
  let contentBody: string | null = body || null;
  if (uploaded) {
    if (uploaded.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "File exceeds the 12 MB limit");
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    const mime = detectFile(uploaded.type, bytes);
    if (!mime) throw new ApiError(415, "Unsupported or invalid file type");
    kind = "download"; contentBody = null; filename = safeFilename(uploaded.name); storageKey = `content/${shopId}/${crypto.randomUUID()}/${filename}`;
    await c.env.LOYDURA_R2.put(storageKey, bytes, { httpMetadata: { contentType: mime }, customMetadata: { shopId: String(shopId), creator: session.walletAddress } });
  }
  const result = await database(c.env).from("shop_content").insert({ shop_id: shopId, creator_address: checked.shop.creator.toLowerCase(), title, kind, body: contentBody, storage_key: storageKey, filename }).select("id,shop_id,title,kind,filename,created_at").single();
  if (result.error) { if (storageKey) await c.env.LOYDURA_R2.delete(storageKey); throw new ApiError(503, "Could not publish content"); }
  return c.json({ content: result.data }, 201);
});

app.delete("/api/content/:id", async (c) => {
  requireBrowserOrigin(c.env, c.req.raw);
  await rateLimit(c.env, c.req.raw, "content-delete", 20, 600);
  const session = await requireSession(c);
  const row = await contentRow(c.env, c.req.param("id"));
  const checked = await isCreator(c.env, BigInt(row.shop_id), session.walletAddress);
  if (!checked.allowed) throw new ApiError(403, "Only the on-chain shop creator can delete content");
  if (row.storage_key) await c.env.LOYDURA_R2.delete(row.storage_key);
  const result = await database(c.env).from("shop_content").delete().eq("id", row.id);
  if (result.error) throw new ApiError(503, "Could not delete content");
  return c.json({ ok: true });
});

app.onError((error, c) => {
  const { status, message } = jsonError(error);
  if (status >= 500) console.error("worker_request_failed", error);
  return c.json({ error: message }, status as 400 | 401 | 403 | 404 | 413 | 415 | 429 | 500 | 503);
});

export { app };
export default app;
