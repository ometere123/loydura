import { describe, expect, it } from "vitest";
import { app, detectFile, safeFilename } from "../src/index";

describe("Worker security helpers", () => {
  it("removes path traversal and control characters from download names", () => {
    const filename = safeFilename("../../secret\r\n.pdf");
    expect(filename).not.toMatch(/[\\/\r\n\0]/);
    expect(filename.startsWith(".")).toBe(false);
  });

  it("keeps ordinary filenames readable", () => {
    expect(safeFilename("guide 2026.pdf")).toBe("guide 2026.pdf");
  });

  it("requires matching magic bytes for approved uploads", () => {
    expect(detectFile("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(detectFile("application/pdf", new TextEncoder().encode("not a pdf"))).toBeNull();
    expect(detectFile("text/plain", new TextEncoder().encode("hello"))).toBe("text/plain");
    expect(detectFile("text/plain", new Uint8Array([0, 1, 2]))).toBeNull();
  });

  it("rejects a cross-origin state-changing request before backend work", async () => {
    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: "https://attacker.invalid" }
    }, { APP_ORIGIN: "http://localhost:3000" } as unknown as Env);
    expect(response.status).toBe(403);
  });

  it("rejects a state-changing request without an origin", async () => {
    const response = await app.request("/api/auth/logout", {
      method: "POST"
    }, { APP_ORIGIN: "http://localhost:3000" } as unknown as Env);
    expect(response.status).toBe(403);
  });

  it("does not report readiness when required secrets are absent", async () => {
    const response = await app.request("/health", {}, {
      APP_ORIGIN: "http://localhost:3000",
      ELYSIUM_RPC_URL: "",
      SUPABASE_URL: "",
      SUPABASE_SECRET_KEY: ""
    } as unknown as Env);
    expect(response.status).toBe(503);
    const body = await response.json() as { status?: string };
    expect(body.status).toBe("degraded");
  });
});
