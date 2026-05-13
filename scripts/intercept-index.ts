/**
 * Intercepteer XHR-responses op index-pagina's. Zoek de API call die tegel-data levert
 * en extract sub-edition IDs.
 */

import { chromium, type Page } from "playwright";

const LOGIN = { code: "1241", password: "t164v5K" };
const INDEX_URL = "https://shop.app4sales.net/GreatHome/#index?edition=72";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Login
  await page.goto("https://shop.app4sales.net/GreatHome/", { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.fill('input[type="text"]:not([type="checkbox"])', LOGIN.code);
  await page.fill('input[type="password"]', LOGIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("login.html"), { timeout: 30000 }),
    page.click('button:has-text("LOGIN")'),
  ]);
  console.log("logged in");

  // Capture alle XHR responses, geen filter
  const candidates: Array<{ url: string; status: number; bytes: number; sample: string }> = [];
  const allUrls: string[] = [];
  page.on("response", async (resp) => {
    const url = resp.url();
    allUrls.push(`${resp.status()} ${url.slice(0, 120)}`);
    if (resp.status() !== 200) return;
    try {
      const ct = resp.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return;
      const text = await resp.text();
      if (text.length < 100) return;
      // Zoek naar tegel-relevante data
      const hasEdition = /\bedition\b/i.test(text);
      const hasDisplay = /DisplayName|Name|Title/.test(text);
      if (hasEdition || hasDisplay) {
        candidates.push({
          url, status: resp.status(), bytes: text.length,
          sample: text.slice(0, 1500),
        });
      }
    } catch {}
  });

  // Trigger het laden van index 72
  console.log(`navigate to ${INDEX_URL}...`);
  await page.goto(INDEX_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  await browser.close();

  console.log(`\n${candidates.length} JSON candidates met edition/Name veld:`);
  for (const c of candidates) {
    console.log(`\n--- ${c.url} (${c.bytes} bytes) ---`);
    console.log(c.sample.slice(0, 1000));
  }
  console.log(`\nAlle ${allUrls.length} responses:`);
  for (const u of allUrls.slice(0, 50)) console.log(`  ${u}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
