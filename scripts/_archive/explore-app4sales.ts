/**
 * Verken shop.app4sales.net structuur.
 *
 * Stappen:
 *   1. Open landing page
 *   2. Login met klantnummer 1241
 *   3. Navigeer naar edition=72 (alles)
 *   4. Wacht tot producten geladen zijn
 *   5. Screenshot + HTML dump voor analyse
 *
 * Gebruik: npx tsx scripts/explore-app4sales.ts
 */

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOGIN = { code: "1241", password: "t164v5K" };
const ENTRY_URL = "https://shop.app4sales.net/GreatHome/#index?edition=72";
const OUT_DIR = join(tmpdir(), "app4sales-explore");
await mkdir(OUT_DIR, { recursive: true });

async function main() {
  console.log("launch browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Capture console + network
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [page error] ${msg.text()}`);
  });

  console.log(`navigate to ${ENTRY_URL}...`);
  await page.goto(ENTRY_URL, { waitUntil: "networkidle", timeout: 60000 });

  console.log("URL after navigation:", page.url());

  // Probeer login form te vinden
  console.log("\nzoek login fields...");
  const inputs = await page.$$eval("input", (els) =>
    els.map((e) => ({
      type: e.type, name: e.name, id: e.id, placeholder: e.placeholder,
    })),
  );
  console.log("Inputs:", JSON.stringify(inputs, null, 2));

  // Screenshot landing
  await page.screenshot({ path: join(OUT_DIR, "1-landing.png"), fullPage: true });
  console.log("screenshot: /tmp/app4sales-1-landing.png");

  // Probeer login: zoek code/password fields
  const codeField = await page.$('input[type="text"], input[placeholder*="ode"], input[placeholder*="email"], input[name*="ode"], input[name*="email"]');
  const passwordField = await page.$('input[type="password"]');

  if (codeField && passwordField) {
    console.log("\nlogin form gevonden — invullen...");
    await codeField.fill(LOGIN.code);
    await passwordField.fill(LOGIN.password);

    // Zoek submit button (LOGIN — uppercase op de site)
    const submit = await page.$('button:has-text("LOGIN"), button[type="submit"], input[type="submit"]');
    if (submit) {
      console.log("submit button found, clicking...");
      await Promise.all([
        page.waitForURL((url) => !url.toString().includes("login.html"), { timeout: 30000 }).catch(() => null),
        submit.click(),
      ]);
      await page.waitForTimeout(3000);
      console.log("URL na login:", page.url());
      await page.screenshot({ path: join(OUT_DIR, "2-after-login.png"), fullPage: true });
    } else {
      console.log("geen submit button gevonden — alle buttons:");
      const buttons = await page.$$eval("button", (els) => els.map((e) => e.textContent?.trim()).slice(0, 10));
      console.log("  ", buttons);
    }
  } else {
    console.log("geen login form op landing — wellicht al ingelogd of andere flow");
  }

  // Screenshot final state
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(OUT_DIR, "3-edition-72.png"), fullPage: true });
  console.log("screenshot: /tmp/app4sales-3-edition-72.png");

  // HTML dump van product container
  const html = await page.content();
  await writeFile(join(OUT_DIR, "page.html"), html);
  console.log(`HTML dump: /tmp/app4sales-page.html (${(html.length / 1024).toFixed(0)} kB)`);

  // Probeer producten te tellen
  const productCounts = await page.evaluate(() => {
    const candidates = [
      ".product", "[class*='product']", "[class*='Product']",
      ".card", "[class*='item-card']", "article",
    ];
    return candidates.map((sel) => ({
      selector: sel,
      count: document.querySelectorAll(sel).length,
    }));
  });
  console.log("\nproduct selectors:");
  for (const c of productCounts) {
    if (c.count > 0) console.log(`  ${c.selector}: ${c.count}`);
  }

  await browser.close();
  console.log("\nklaar");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
