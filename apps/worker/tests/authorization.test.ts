import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = "0x0000000000000000000000000000000000000001";
const MEMBER = "0x0000000000000000000000000000000000000002";
const OTHER = "0x0000000000000000000000000000000000000003";
const CONTENT_ID = "11111111-1111-4111-8111-111111111111";
const ORIGIN = "https://loydura.vercel.app";

const state = vi.hoisted(() => {
  const sessions = new Map<string, { token_hash: string; wallet_address: string; expires_at: string }>();
  let membershipExpiry = 0n;
  const r2 = {
    get: vi.fn(async () => ({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("private content"));
          controller.close();
        }
      }),
      size: 15,
      httpMetadata: { contentType: "text/plain" }
    })),
    delete: vi.fn(async () => undefined)
  };
  const chain = {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "getShop") return { creator: "0x0000000000000000000000000000000000000001", token: "0x0000000000000000000000000000000000000010", price: 1n, exists: true };
      if (functionName === "membershipExpires") return membershipExpiry;
      throw new Error(`Unexpected contract read: ${functionName}`);
    }),
    getBlock: vi.fn(async () => ({ timestamp: 1_000n }))
  };
  const content = {
    id: "11111111-1111-4111-8111-111111111111",
    shop_id: 1,
    creator_address: "0x0000000000000000000000000000000000000001",
    title: "Private guide",
    kind: "download" as const,
    body: null,
    storage_key: "content/1/private-guide.txt",
    filename: "private-guide.txt",
    created_at: "2026-10-21T00:00:00.000Z"
  };
  const db = {
    from(table: string) {
      return {
        select() {
          const filters = new Map<string, unknown>();
          const query = {
            eq(key: string, value: unknown) {
              filters.set(key, value);
              return query;
            },
            async maybeSingle() {
              if (table === "app_sessions") {
                const row = [...sessions.values()].find((candidate) => [...filters.entries()].every(([key, value]) => candidate[key as keyof typeof candidate] === value));
                return { data: row || null, error: null };
              }
              if (table === "shop_content") {
                const matches = [...filters.entries()].every(([key, value]) => content[key as keyof typeof content] === value);
                return { data: matches ? content : null, error: null };
              }
              return { data: null, error: null };
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
    async rpc(name: string) {
      if (name === "consume_rate_limit") return { data: true, error: null };
      return { data: false, error: null };
    }
  };

  return {
    db,
    chain,
    r2,
    sessions,
    set membershipExpiry(value: bigint) { membershipExpiry = value; },
    reset() {
      sessions.clear();
      membershipExpiry = 0n;
      chain.readContract.mockClear();
      chain.getBlock.mockClear();
      r2.get.mockClear();
      r2.delete.mockClear();
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

const ENV = {
  APP_ORIGIN: ORIGIN,
  SUPABASE_URL: "https://supabase.invalid",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  ELYSIUM_RPC_URL: "https://rpc.invalid",
  LOYDURA_HUB_ADDRESS: "0x0000000000000000000000000000000000000004",
  LOYDURA_REWARDS_ADDRESS: "0x0000000000000000000000000000000000000005",
  LOYDURA_USDC_ADDRESS: "0x0000000000000000000000000000000000000006",
  LOYDURA_R2: state.r2
} as unknown as Env;

let app: (typeof import("../src/index"))["app"];

beforeAll(async () => {
  ({ app } = await import("../src/index"));
}, 60_000);

beforeEach(() => {
  state.reset();
});

async function sessionCookie(walletAddress: string): Promise<string> {
  const token = walletAddress.slice(-1).repeat(64);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  state.sessions.set(tokenHash, {
    token_hash: tokenHash,
    wallet_address: walletAddress,
    expires_at: new Date(Date.now() + 60_000).toISOString()
  });
  return `loydura_session=${token}`;
}

describe("Worker authorization and private content", () => {
  it("rejects creator mutations from a wallet that is not the on-chain owner", async () => {
    const cookie = await sessionCookie(OTHER);
    const response = await app.request("/api/shop", {
      method: "POST",
      headers: { Origin: ORIGIN, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: 1, name: "Attacker edit", description: "No" })
    }, ENV);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Only the on-chain shop creator can edit this profile" });
  });

  it("denies expired members before reading protected content or R2", async () => {
    const cookie = await sessionCookie(MEMBER);
    const response = await app.request("/api/content/" + CONTENT_ID + "/download", {
      headers: { Cookie: cookie, Origin: ORIGIN }
    }, ENV);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Active on-chain membership is required" });
    expect(state.r2.get).not.toHaveBeenCalled();
  });

  it("streams private R2 content only for an active on-chain member", async () => {
    state.membershipExpiry = 2_000n;
    const cookie = await sessionCookie(MEMBER);
    const response = await app.request("/api/content/" + CONTENT_ID + "/download", {
      headers: { Cookie: cookie, Origin: ORIGIN }
    }, ENV);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("private content");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="private-guide.txt"');
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(state.r2.get).toHaveBeenCalledWith("content/1/private-guide.txt");
  });

  it("does not delete R2 objects when a non-owner attempts content deletion", async () => {
    const cookie = await sessionCookie(OTHER);
    const response = await app.request("/api/content/" + CONTENT_ID, {
      method: "DELETE",
      headers: { Origin: ORIGIN, Cookie: cookie }
    }, ENV);
    expect(response.status).toBe(403);
    expect(state.r2.delete).not.toHaveBeenCalled();
  });
});
