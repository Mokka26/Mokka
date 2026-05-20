/**
 * Fetch alle edition-IDs via API en hun Children. Bouw een complete map.
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import { writeFile } from "node:fs/promises";

void (null as unknown as BrowserContext);

const LOGIN = { code: "1241", password: "t164v5K" };

async function login(page: Page) {
  await page.goto("https://shop.app4sales.net/GreatHome/", { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.fill('input[type="text"]:not([type="checkbox"])', LOGIN.code);
  await page.fill('input[type="password"]', LOGIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("login.html"), { timeout: 30000 }),
    page.click('button:has-text("LOGIN")'),
  ]);
}

interface EditionChild {
  Id: string;
  PictureId: number;
  Name: string;
  IsEdition: boolean;
  HasItems: boolean;
  HasEditions: boolean;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await login(page);

  // Capture v2/edition/<id> responses tijdens natuurlijke navigatie
  const captured: Map<string, string> = new Map();
  page.on("response", async (resp) => {
    const url = resp.url();
    const m = url.match(/\/v2\/edition\/(\d+)/);
    if (!m || resp.status() !== 200) return;
    try {
      captured.set(m[1], await resp.text());
    } catch {}
  });

  // De index-URLs uit links.txt
  const indexEditions = ["72", "77", "75", "58", "56", "51"];

  // Voor elke index, navigeer en wacht — dat triggert de API call
  for (const ed of indexEditions) {
    await page.goto(`https://shop.app4sales.net/GreatHome/#index?edition=${ed}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    if (!captured.has(ed)) {
      console.log(`  edition ${ed}: GEEN response gecaptured`);
    }
  }

  // Parse capture
  const allChildren: Array<{ parent: string; child: EditionChild }> = [];
  for (const [ed, text] of captured) {
    try {
      const json = JSON.parse(text);
      const children: EditionChild[] = json.Children ?? [];
      console.log(`\n  edition ${ed} (${json.Parent?.Name}): ${children.length} children`);
      for (const c of children) {
        console.log(`    [${c.PictureId}] ${c.Name}`);
        allChildren.push({ parent: ed, child: c });
      }
    } catch (e) {
      console.log(`  edition ${ed}: parse error`);
    }
  }

  await browser.close();

  await writeFile("scripts/index-children.json", JSON.stringify(allChildren, null, 2));
  console.log(`\nTotaal ${allChildren.length} children — opgeslagen in scripts/index-children.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
