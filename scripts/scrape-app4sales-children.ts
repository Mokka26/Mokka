/**
 * Scrape alle sub-catalogi uit scripts/index-children.json en merge met
 * bestaande app4sales-products.json. Past filter-uitsluitingen toe per parent.
 */

import { chromium, type Page } from "playwright";
import { readFile, writeFile } from "node:fs/promises";

const LOGIN = { code: "1241", password: "t164v5K" };
const BASE = "https://shop.app4sales.net/GreatHome/";

interface IndexChild {
  parent: string;
  child: { Id: string; PictureId: number; Name: string; HasItems: boolean };
}

interface Product {
  code: string; name: string;
  price: number | null; originalPrice: number | null;
  imageUrl: string; inStock: boolean;
  catalogEdition: string;
  parentEdition?: string;
  collectionName?: string;
}

// Filter rules per parent edition (uit links.txt annotaties)
const EXCLUDE_BY_PARENT: Record<string, RegExp[]> = {
  // edition=58 "behalve loqum ceramic"
  "58": [/loqum/i],
  // edition=51 "alles behalve new papatya en Ibiza zb en onix zb"
  "51": [/new papatya/i, /\bibiza\b/i, /\bonix\b/i],
};

async function login(page: Page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.fill('input[type="text"]:not([type="checkbox"])', LOGIN.code);
  await page.fill('input[type="password"]', LOGIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("login.html"), { timeout: 30000 }),
    page.click('button:has-text("LOGIN")'),
  ]);
  console.log("logged in");
}

async function autoScroll(page: Page) {
  let prev = 0;
  for (let i = 0; i < 30; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    if (h === prev) break;
    prev = h;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }
}

async function extractCatalogProducts(page: Page, edition: string, parent: string, collectionName: string): Promise<Product[]> {
  const url = `${BASE}#catalog?edition=${edition}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await autoScroll(page);

  const products = await page.evaluate(() => {
    const cdnImgs = Array.from(document.querySelectorAll<HTMLImageElement>(
      "img[src*='/api/v2/images/item/']",
    ));
    return cdnImgs.map((img) => {
      let container: HTMLElement | null = img.parentElement;
      for (let depth = 0; depth < 10 && container; depth++) {
        if (container.querySelector(".price, [class*='rice']") &&
            container.textContent && container.textContent.match(/\d{7,}/)) break;
        container = container.parentElement;
      }
      if (!container) return null;

      const text = container.textContent ?? "";
      const codeMatch = text.match(/\b(\d{9,12})\b/);
      const code = codeMatch?.[1] ?? null;

      const priceMatches = Array.from(text.matchAll(/EUR\s*([\d,.]+)/gi));
      const prices = priceMatches.map((m) => parseFloat(m[1].replace(",", ".")));
      const originalPrice = prices.length >= 2 ? prices[0] : null;
      const price = prices.length >= 2 ? prices[1] : (prices[0] ?? null);

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const candidates: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const t = (node.textContent ?? "").trim();
        if (t.length < 8) continue;
        if (/EUR|\bexcl|\bincl|\bVAT|MORE INFO/i.test(t)) continue;
        if (/^\d/.test(t)) continue;
        const letters = t.replace(/[^A-Za-z]/g, "");
        const uppers = t.replace(/[^A-Z]/g, "");
        if (letters.length >= 5 && uppers.length / letters.length > 0.6) candidates.push(t);
      }
      candidates.sort((a, b) => b.length - a.length);
      const name = candidates[0] ?? null;

      const inStock = !text.toLowerCase().includes("not available");
      return { code, name, price, originalPrice, imageUrl: img.src, inStock };
    }).filter((p) => p && p.imageUrl) as Array<{
      code: string | null; name: string | null;
      price: number | null; originalPrice: number | null;
      imageUrl: string; inStock: boolean;
    }>;
  });

  return products
    .filter((p) => p.code)
    .map((p) => ({
      code: p.code!, name: p.name ?? "Onbekend",
      price: p.price, originalPrice: p.originalPrice,
      imageUrl: p.imageUrl, inStock: p.inStock,
      catalogEdition: edition, parentEdition: parent, collectionName,
    }));
}

function shouldExclude(child: IndexChild): boolean {
  const rules = EXCLUDE_BY_PARENT[child.parent];
  if (!rules) return false;
  return rules.some((r) => r.test(child.child.Name));
}

async function main() {
  const children: IndexChild[] = JSON.parse(await readFile("scripts/index-children.json", "utf8"));
  const existingRaw = await readFile("scripts/app4sales-products.json", "utf8").catch(() => "[]");
  const existing: Product[] = JSON.parse(existingRaw);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await login(page);

  // Filter children
  const toScrape = children.filter((c) => c.child.HasItems && !shouldExclude(c));
  const skipped = children.filter((c) => !c.child.HasItems || shouldExclude(c));
  console.log(`\n${toScrape.length} sub-catalogi te scrapen (${skipped.length} overgeslagen om filters):`);
  for (const s of skipped) {
    const reason = !s.child.HasItems ? "geen items" : "uitgesloten door filter";
    console.log(`  SKIP [${s.child.PictureId}] ${s.child.Name} — ${reason}`);
  }

  const allNew: Product[] = [];
  for (const c of toScrape) {
    const ed = String(c.child.PictureId);
    console.log(`\n[parent=${c.parent}] ${c.child.Name} → edition=${ed}`);
    try {
      const items = await extractCatalogProducts(page, ed, c.parent, c.child.Name);
      console.log(`  ${items.length} producten`);
      allNew.push(...items);
    } catch (e) {
      console.error(`  FOUT: ${(e as Error).message}`);
    }
  }
  await browser.close();

  // Merge met bestaande, dedupe op code
  const codeMap = new Map<string, Product>();
  for (const p of existing) codeMap.set(p.code, p);
  let added = 0;
  for (const p of allNew) {
    if (!codeMap.has(p.code)) {
      codeMap.set(p.code, p);
      added++;
    }
  }
  const merged = Array.from(codeMap.values());
  await writeFile("scripts/app4sales-products.json", JSON.stringify(merged, null, 2));
  console.log(`\n=== ${added} nieuwe producten toegevoegd; totaal nu ${merged.length} ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
