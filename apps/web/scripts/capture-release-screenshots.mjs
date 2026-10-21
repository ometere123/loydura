import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const productionOrigin = "https://loydura.vercel.app";
const previousDeployment =
  "https://loydura-669g1f9lt-delealufejoel-4184s-projects.vercel.app";
const outputDirectory = path.resolve(
  process.cwd(),
  "docs/evidence/screenshots",
);

const routes = [
  ["home", "/"],
  ["discover", "/discover"],
  ["studio", "/studio"],
  ["dashboard", "/me"],
  ["shop-1", "/shop/1"],
  ["campaign-1", "/campaign/1"],
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const desktop = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

for (const [name, route] of routes) {
  await desktop.goto(`${productionOrigin}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await desktop.waitForTimeout(3_000);
  await desktop.screenshot({
    path: path.join(outputDirectory, `after-${name}-1440.png`),
    fullPage: true,
  });
}

const mobile = await browser.newPage({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 1,
});
await mobile.goto(productionOrigin, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await mobile.waitForTimeout(3_000);
await mobile.screenshot({
  path: path.join(outputDirectory, "after-home-375.png"),
  fullPage: true,
});

const before = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
await before.goto(previousDeployment, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await before.waitForTimeout(3_000);
await before.screenshot({
  path: path.join(outputDirectory, "before-home-1440.png"),
  fullPage: true,
});

await browser.close();
