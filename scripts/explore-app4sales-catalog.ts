/**
 * Verken een specifieke catalog (#catalog?edition=N) na login.
 * Hergebruik storage state om sneller te zijn.
 *
 * Gebruik: npx tsx scripts/explore-app4sales-catalog.ts <edition>
 */

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOGIN = { code: "1241", password: "t164v5K" };
const edition = process.argv[2] ?? "513";
const URL = `https://shop.app4sales.net/GreatHome/#catalog?edition=${edition}`;
const OUT_DIR = join(tmpdir(), `app4sales-cat-${edition}`);
await mkdir(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Login
  console.log("login...");
  await page.goto("https://shop.app4sales.net/GreatHome/", { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="text"]:not([type="checkbox"])', LOGIN.code);
  await page.fill('input[type="password"]', LOGIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("login.html"), { timeout: 30000 }),
    page.click('button:has-text("LOGIN")'),
  ]);
  console.log("logged in:", page.url());

  // Navigate to catalog
  console.log(`\nnavigate to edition=${edition}...`);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  // Screenshot full page
  await page.screenshot({ path: join(OUT_DIR, "catalog.png"), fullPage: true });
  console.log(`screenshot: ${OUT_DIR}/catalog.png`);

  // Extract structure: alle img tags + href tags
  const imgs = await page.$$eval("img", (els) =>
    els.map((e) => ({
      src: e.src,
      alt: e.alt,
      width: e.naturalWidth,
      height: e.naturalHeight,
    })).filter((i) => i.src && !i.src.startsWith("data:") && i.width > 100),
  );
  console.log(`\n${imgs.length} images >100px (cdn product foto's):`);
  for (const i of imgs.slice(0, 15)) {
    console.log(`  ${i.width}x${i.height}  alt="${i.alt}"  ${i.src.slice(0, 100)}`);
  }

  // HTML dump
  const html = await page.content();
  await writeFile(join(OUT_DIR, "page.html"), html);
  console.log(`\nHTML: ${OUT_DIR}/page.html (${(html.length / 1024).toFixed(0)} kB)`);

  // Common product container classes
  const counts = await page.evaluate(() => {
    const sels = [
      "article", ".product-tile", ".product-item", ".product-card",
      "[class*='product']", "[class*='Product']", "[class*='item']",
      "[ng-repeat]", "[data-product]",
    ];
    return sels.map((s) => ({ s, n: document.querySelectorAll(s).length }));
  });
  console.log("\nproduct container candidates:");
  for (const c of counts) if (c.n > 0) console.log(`  ${c.s}: ${c.n}`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
