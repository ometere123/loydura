import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  type Nonce = { nonce: string; wallet_address: string; chain_id: number; expires_at: string; consumed: boolean };
  type Session = { token_hash: string; wallet_address: string; expires_at: string };

  const nonces = new Map<string, Nonce>();
  const sessions = new Map<string, Session>();
  let rateLimitCalls = 0;
  let consumeNonceCalls = 0;
  let signatureValid = true;

  const db = {
    from(table: string) {
      return {
        async insert(value: Nonce | Session) {
          if (table === "siwe_nonces") nonces.set((value as Nonce).nonce, { ...(value as Nonce), consumed: false });
          if (table === "app_sessions") sessions.set((value as Session).token_hash, value as Session);
          return { data: value, error: null };
        },
        select() {
          const filters = new Map<string, unknown>();
          const query = {
            eq(key: string, value: unknown) {
              filters.set(key, value);
              return query;
            },
            async maybeSingle() {
              if (table !== "app_sessions") return { data: null, error: null };
              const row = [...sessions.values()].find((candidate) => [...filters.entries()].every(([key, value]) => candidate[key as keyof Session] === value));
              return { data: row || null, error: null };
            }
          };
          return query;
        },
        delete() {
          return {
            async eq(key: string, value: unknown) {
              if (table === "app_sessions" && key === "token_hash") sessions.delete(String(value));
              return { data: null, error: null };
            }
          };
        }
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "consume_rate_limit") {
        rateLimitCalls += 1;
        return { data: true, error: null };
      }
      if (name === "consume_siwe_nonce") {
        consumeNonceCalls += 1;
        const nonce = nonces.get(String(args.p_nonce));
        const valid = !!nonce
          && !nonce.consumed
          && nonce.wallet_address === String(args.p_address)
          && nonce.chain_id === args.p_chain_id
          && Date.parse(nonce.expires_at) > Date.now();
        if (valid) nonce!.consumed = true;
        return { data: valid, error: null };
      }
      return { data: null, error: null };
    }
  };

  const chain = {
    verifyMessage: vi.fn(async () => signatureValid)
  };

  return {
    db,
    chain,
    nonces,
    sessions,
    get rateLimitCalls() { return rateLimitCalls; },
    get consumeNonceCalls() { return consumeNonceCalls; },
    set signatureValid(value: boolean) { signatureValid = value; },
    reset() {
      nonces.clear();
      sessions.clear();
      rateLimitCalls = 0;
      consumeNonceCalls = 0;
      signatureValid = true;
      chain.verifyMessage.mockClear();
    }
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => state.db)
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => state.chain),
    http: vi.fn(() => ({ type: "mock" }))
  };
});

const ORIGIN = "https://loydura.vercel.app";
const ADDRESS = "0x0000000000000000000000000000000000000001";
const ENV = {
  APP_ORIGIN: ORIGIN,
  SUPABASE_URL: "https://supabase.invalid",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  ELYSIUM_RPC_URL: "https://rpc.invalid",
  LOYDURA_HUB_ADDRESS: "0x0000000000000000000000000000000000000002",
  LOYDURA_REWARDS_ADDRESS: "0x0000000000000000000000000000000000000003",
  LOYDURA_USDC_ADDRESS: "0x0000000000000000000000000000000000000004",
  LOYDURA_R2: {}
} as unknown as Env;

let app: (typeof import("../src/index"))["app"];

beforeAll(async () => {
  ({ app } = await import("../src/index"));
}, 60_000);

beforeEach(() => {
  state.reset();
});

function makeMessage(nonce: string, overrides: { domain?: string; chainId?: number; issuedAt?: string; expirationTime?: string } = {}): string {
  const issuedAt = overrides.issuedAt || new Date(Date.now() - 1_000).toISOString();
  const expirationTime = overrides.expirationTime || new Date(Date.now() + 4 * 60_000).toISOString();
  return [
    `${overrides.domain || new URL(ORIGIN).host} wants you to sign in with your Ethereum account:`,
    ADDRESS,
    "",
    "Sign in to Loydura.",
    "",
    `URI: ${ORIGIN}`,
    "Version: 1",
    `Chain ID: ${overrides.chainId || 99801}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`
  ].join("\n");
}

async function requestNonce(): Promise<string> {
  const response = await app.request("/api/auth/nonce", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ address: ADDRESS })
  }, ENV);
  expect(response.status).toBe(200);
  return (await response.json() as { nonce: string }).nonce;
}

function cookieValue(response: Response): string {
  const cookie = response.headers.get("Set-Cookie");
  expect(cookie).toBeTruthy();
  return cookie!.split(";", 1)[0];
}

describe("Worker SIWE authentication lifecycle", () => {
  it("creates a secure session, rejects replay, and logs out", async () => {
    const nonce = await requestNonce();
    const verify = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: makeMessage(nonce), signature: "0x1234" })
    }, ENV);

    expect(verify.status).toBe(200);
    const sessionCookie = cookieValue(verify);
    expect(sessionCookie).toMatch(/^loydura_session=[0-9a-f]{64}$/i);
    expect(verify.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(verify.headers.get("Set-Cookie")).toContain("Secure");
    expect(verify.headers.get("Set-Cookie")).toContain("SameSite=Lax");
    expect(state.consumeNonceCalls).toBe(1);

    const session = await app.request("/api/auth/session", { headers: { Cookie: sessionCookie } }, ENV);
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ authenticated: true, address: ADDRESS });

    const replay = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: makeMessage(nonce), signature: "0x1234" })
    }, ENV);
    expect(replay.status).toBe(401);
    expect(state.sessions.size).toBe(1);

    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: ORIGIN, Cookie: sessionCookie }
    }, ENV);
    expect(logout.status).toBe(200);
    expect(logout.headers.get("Set-Cookie")).toContain("Max-Age=0");

    const afterLogout = await app.request("/api/auth/session", { headers: { Cookie: sessionCookie } }, ENV);
    expect(await afterLogout.json()).toMatchObject({ authenticated: false, address: null });
  });

  it("rejects malformed SIWE instead of returning an internal error", async () => {
    const response = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "not a SIWE message", signature: "0x1234" })
    }, ENV);
    expect(response.status).toBe(401);
    expect(state.consumeNonceCalls).toBe(0);
  });

  it.each([
    ["wrong domain", { domain: "attacker.invalid" }],
    ["wrong chain", { chainId: 1 }]
  ])("rejects %s before consuming the nonce", async (_label, overrides) => {
    const nonce = await requestNonce();
    const response = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: makeMessage(nonce, overrides), signature: "0x1234" })
    }, ENV);
    expect(response.status).toBe(401);
    expect(state.consumeNonceCalls).toBe(0);
    expect(state.nonces.get(nonce)?.consumed).toBe(false);
  });

  it("rejects an expired SIWE message and an expired stored session", async () => {
    const nonce = await requestNonce();
    const expired = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: makeMessage(nonce, {
          issuedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
          expirationTime: new Date(Date.now() - 5 * 60_000).toISOString()
        }),
        signature: "0x1234"
      })
    }, ENV);
    expect(expired.status).toBe(401);
    expect(state.nonces.get(nonce)?.consumed).toBe(false);

    const token = "a".repeat(64);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    state.sessions.set(tokenHash, {
      token_hash: tokenHash,
      wallet_address: ADDRESS,
      expires_at: new Date(Date.now() - 1_000).toISOString()
    });
    const session = await app.request("/api/auth/session", { headers: { Cookie: `loydura_session=${token}` } }, ENV);
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ authenticated: false, address: null });
    expect(state.sessions.has(tokenHash)).toBe(false);
  });
});
