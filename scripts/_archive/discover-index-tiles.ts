/**
 * Klik elke tegel op een index-pagina en capture de resulterende #catalog hash.
 * Dit ontdekt de sub-catalog editions die we anders missen.
 */

import { chromium, type Page } from "playwright";
import { writeFile } from "node:fs/promises";

const LOGIN = { code: "1241", password: "t164v5K" };
const INDEX_URLS = [
  "https://shop.app4sales.net/GreatHome/#index?edition=72",
  "https://shop.app4sales.net/GreatHome/#index?edition=77",
  "https://shop.app4sales.net/GreatHome/#index?edition=75",
  "https://shop.app4sales.net/GreatHome/#index?edition=58",
  "https://shop.app4sales.net/GreatHome/#index?edition=56",
  "https://shop.app4sales.net/GreatHome/#index?edition=51",
];

async function login(page: Page) {
  await page.goto("https://shop.app4sales.net/GreatHome/", { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.fill('input[type="text"]:not([type="checkbox"])', LOGIN.code);
  await page.fill('input[type="password"]', LOGIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("login.html"), { timeout: 30000 }),
    page.click('button:has-text("LOGIN")'),
  ]);
  console.log("logged in");
}

async function discoverByClick(page: Page, indexUrl: string): Promise<{ edition: string; label: string }[]> {
  console.log(`\n=== ${indexUrl} ===`);
  await page.goto(indexUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Vind alle "tile" elementen — cards met afbeelding + label
  // Probeer veel selectors
  const tileSelectors = await page.evaluate(() => {
    const candidates = [
      "[class*='tile']", "[class*='Tile']", "[class*='card']", "[class*='Card']",
      "[ng-click]", "[data-edition]", "[role='link']", "[role='button']",
    ];
    const counts: Record<string, number> = {};
    for (const s of candidates) {
      counts[s] = document.querySelectorAll(s).length;
    }
    return counts;
  });
  console.log("  selector counts:", tileSelectors);

  // Probeer alles met een achtergrond-image in de hoofd-content area
  const tiles = await page.$$eval(
    "[ng-click], [class*='tile'], [class*='card']",
    (els) => els
      .filter((e) => e.querySelector("img") || (e as HTMLElement).style?.backgroundImage)
      .map((e, i) => ({
        idx: i,
        text: (e.textContent ?? "").trim().slice(0, 50),
        ngClick: e.getAttribute("ng-click"),
        outerSnippet: e.outerHTML.slice(0, 200),
      })),
  );

  console.log(`  ${tiles.length} mogelijke tegels:`);
  for (const t of tiles.slice(0, 5)) console.log(`    [${t.idx}] "${t.text}" ng-click="${t.ngClick}"`);

  // Voor elke tegel: klik, vang de URL, ga terug
  const found: { edition: string; label: string }[] = [];
  // Alleen unieke tegel-textes proberen om dubbel werk te vermijden
  const uniqLabels = new Set<string>();
  for (const t of tiles) {
    if (uniqLabels.has(t.text)) continue;
    uniqLabels.add(t.text);
    try {
      await page.goto(indexUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      const allTiles = await page.$$("[ng-click], [class*='tile'], [class*='card']");
      const target = allTiles[t.idx];
      if (!target) continue;
      await target.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      const url = page.url();
      const m = url.match(/#catalog\?edition=(\d+)/);
      if (m) {
        console.log(`    "${t.text}" → edition=${m[1]}`);
        found.push({ edition: m[1], label: t.text });
      }
    } catch (e) {
      // skip
    }
  }
  return found;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await login(page);

  const all = new Map<string, string>();
  for (const url of INDEX_URLS) {
    const tiles = await discoverByClick(page, url);
    for (const t of tiles) {
      if (!all.has(t.edition)) all.set(t.edition, t.label);
    }
  }

  await browser.close();
  console.log(`\n=== Totaal ${all.size} unieke sub-catalog editions gevonden ===`);
  for (const [edition, label] of all) console.log(`  ${edition.padEnd(5)} ${label}`);

  await writeFile("scripts/index-tiles.json", JSON.stringify(Array.from(all.entries()), null, 2));
  console.log("\nopgeslagen in scripts/index-tiles.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
