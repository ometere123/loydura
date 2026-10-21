import { test, expect } from "@playwright/test";

import { buildSiweMessage } from "../lib/siwe";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
});

test("SIWE message uses real EIP-4361 line breaks", () => {
  const message = buildSiweMessage({
    domain: "loydura.vercel.app",
    address: "0x0000000000000000000000000000000000000001",
    statement: "Sign in to Loydura.",
    uri: "https://loydura.vercel.app",
    version: "1",
    chainId: 99801,
    nonce: "0123456789abcdef0123456789abcdef",
    issuedAt: "2026-10-21T00:00:00.000Z",
    expirationTime: "2026-10-21T00:04:00.000Z"
  });
  expect(message).toContain("\nURI: https://loydura.vercel.app\n");
  expect(message).not.toContain("\\n");
});

test("public app has five navigable workflows",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/");
  await expect(page.getByRole("heading",{name:/Give your token a reason to exist/i})).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link",{name:"Discover"})).toHaveAttribute("href","/discover");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link",{name:"Creator Studio"})).toHaveAttribute("href","/studio");
  await page.goto("/discover",{waitUntil:"commit",timeout:60000});
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading",{name:/Find utility worth committing to/i})).toBeVisible({timeout:30000});
  await page.goto("/studio",{waitUntil:"commit",timeout:60000});
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("heading",{name:/Launch utility with the details in view/i})).toBeVisible({timeout:30000});
  await expect(page.getByRole("heading",{name:"Connect the creator wallet to begin."})).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link",{name:"My Dashboard"})).toHaveAttribute("href","/me");
  await page.goto("/me",{waitUntil:"commit",timeout:60000});
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading",{name:/Your commitments/i})).toBeVisible();
});

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`homepage remains usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Give your token a reason to exist/i })).toBeVisible();
    await expect(page.locator('a[href="/discover"]').first()).toHaveAttribute("href", "/discover");
    await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
  });
}
