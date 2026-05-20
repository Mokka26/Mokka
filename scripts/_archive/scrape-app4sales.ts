/**
 * Scrape Great Home / app4sales B2B portal.
 *
 * Workflow:
 *   1. Login via Playwright
 *   2. Voor elke URL in links.txt:
 *      - "index": extracteer sub-catalogi en process elk
 *      - "catalog": extracteer producten (auto-scroll voor lazy-load)
 *   3. Pas filter-annotaties toe ("alleen op voorraad", "behalve X")
 *   4. Dump alles naar scripts/app4sales-products.json voor review
 *
 * Geen Cloudinary/DB writes in deze fase — alleen extractie.
 *
 * Gebruik: npx tsx scripts/scrape-app4sales.ts
 */

import { chromium, type Page } from "playwright";
import { readFile, writeFile } from "node:fs/promises";

const LOGIN = { code: "1241", password: "t164v5K" };
const BASE = "https://shop.app4sales.net/GreatHome/";

interface SourceUrl {
  url: string;
  edition: string;
  type: "index" | "catalog";
  filterNote?: string;
}

interface Product {
  code: string;
  name: string;
  price: number | null;       // EUR excl BTW (B2B inkoop)
  originalPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  catalogEdition: string;
  filterNote?: string;
}

function parseLinksFile(text: string): SourceUrl[] {
  const lines = text.split("\n").map((l) => l.trim());
  const urls: SourceUrl[] = [];
  for (const line of lines) {
    const m = line.match(/^(https:\/\/shop\.app4sales\.net\/GreatHome\/#(index|catalog)\?edition=(\d+))(.*)$/);
    if (!m) continue;
    const note = m[4]?.trim() || undefined;
    urls.push({
      url: m[1],
      type: m[2] as "index" | "catalog",
      edition: m[3],
      filterNote: note,
    });
  }
  return urls;
}

async function login(page: Page) {
  console.log("login...");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.fill('input[type="text"]:not([type="checkbox"])', LOGIN.code);
  await page.fill('input[type="password"]', LOGIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("login.html"), { timeout: 30000 }),
    page.click('button:has-text("LOGIN")'),
  ]);
  console.log(`  ingelogd: ${page.url()}`);
}

async function autoScroll(page: Page) {
  // Scroll naar onderen totdat geen nieuwe content laadt
  let prevHeight = 0;
  for (let i = 0; i < 30; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    if (h === prevHeight) break;
    prevHeight = h;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }
}

async function discoverCatalogsFromIndex(page: Page, indexUrl: string): Promise<string[]> {
  console.log(`  discover catalogs in index ${indexUrl}...`);
  await page.goto(indexUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await autoScroll(page);

  // Multi-strategy edition discovery: anchor href, data-*, onclick, en alle text content
  const editions = await page.evaluate(() => {
    const found = new Set<string>();
    // Strategy 1: anchor hrefs
    document.querySelectorAll("a").forEach((a) => {
      const m = (a as HTMLAnchorElement).href?.match(/edition=(\d+)/g);
      m?.forEach((s) => found.add(s.split("=")[1]));
    });
    // Strategy 2: alle elementen met data-* attributes
    document.querySelectorAll("*").forEach((el) => {
      for (const attr of el.attributes) {
        const m = attr.value.match(/edition=(\d+)/g);
        m?.forEach((s) => found.add(s.split("=")[1]));
      }
    });
    // Strategy 3: inline scripts en HTML voor edition= patronen (binnen catalog-context)
    const html = document.documentElement.innerHTML;
    const matches = html.matchAll(/#catalog\?edition=(\d+)/g);
    for (const m of matches) found.add(m[1]);
    return Array.from(found);
  });
  console.log(`    ${editions.length} sub-catalogs gevonden: ${editions.slice(0, 20).join(", ")}${editions.length > 20 ? "..." : ""}`);
  return editions;
}

async function extractCatalogProducts(page: Page, edition: string, filterNote?: string): Promise<Product[]> {
  const url = `${BASE}#catalog?edition=${edition}`;
  console.log(`  extract catalog ${edition}${filterNote ? ` (${filterNote})` : ""}...`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Apply "alleen op voorraad" filter via UI label (input is vaak hidden)
  if (filterNote?.toLowerCase().includes("voorraad")) {
    const stockLabel = await page.$('label:has-text("Available In Stock"), label:has-text("Op voorraad")');
    if (stockLabel) {
      try {
        await stockLabel.click({ timeout: 5000, force: true });
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log(`    stock-filter klik mislukt: ${(e as Error).message.slice(0, 60)}`);
      }
    }
  }

  await autoScroll(page);

  // Extracteer producten via DOM scraping
  // Productkaart structuur (uit screenshot edition=513):
  //   - image: <img src="...api.app4sales.net/.../images/item/HASH">
  //   - code: tekstlabel boven prijs
  //   - prijzen: EUR <strikethrough> + EUR <current>
  //   - naam: KIMBERLY EXT. DT 160/200X90X75 BLACK VENEER PLAIN
  //   - voorraad: green check / red X
  const products = await page.evaluate(() => {
    // Vind alle product image elements (CDN links naar /images/item/)
    const cdnImgs = Array.from(document.querySelectorAll<HTMLImageElement>(
      "img[src*='/api/v2/images/item/']",
    ));

    return cdnImgs.map((img) => {
      // Loop omhoog tot we het product container element vinden
      let container: HTMLElement | null = img.parentElement;
      for (let depth = 0; depth < 10 && container; depth++) {
        // Zoek container met code + prijs erin
        if (container.querySelector(".price, [class*='rice']") &&
            container.textContent && container.textContent.match(/\d{7,}/)) break;
        container = container.parentElement;
      }
      if (!container) return null;

      const text = container.textContent ?? "";
      // Code: zoek 9-12 digit nummer dat NIET een prijs is
      const codeMatch = text.match(/\b(\d{9,12})\b/);
      const code = codeMatch?.[1] ?? null;

      // Prijzen: "EUR 475.00" originele, "EUR 380.00" huidige
      const priceMatches = Array.from(text.matchAll(/EUR\s*([\d,.]+)/gi));
      const prices = priceMatches.map((m) => parseFloat(m[1].replace(",", ".")));
      const originalPrice = prices.length >= 2 ? prices[0] : null;
      const price = prices.length >= 2 ? prices[1] : (prices[0] ?? null);

      // Naam: itereer alle text-nodes en pak de langste UPPERCASE regel
      // die GEEN "EUR" of cijferprijs bevat
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const candidates: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const t = (node.textContent ?? "").trim();
        if (t.length < 8) continue;
        if (/EUR|\bexcl|\bincl|\bVAT|MORE INFO/i.test(t)) continue;
        if (/^\d/.test(t)) continue;
        // Check uppercase ratio (product namen zijn vaak UPPERCASE)
        const letters = t.replace(/[^A-Za-z]/g, "");
        const uppers = t.replace(/[^A-Z]/g, "");
        if (letters.length >= 5 && uppers.length / letters.length > 0.6) {
          candidates.push(t);
        }
      }
      // Pak de langste candidate (meestal de volledige product naam)
      candidates.sort((a, b) => b.length - a.length);
      const name = candidates[0] ?? null;

      // Voorraad: zoek voor groene check / rode X
      const stockEl = container.querySelector('[class*="stock"], [class*="Stock"], svg[class*="check"]');
      const inStock = stockEl ? !container.textContent?.toLowerCase().includes("not available") : true;

      return {
        code, name, price, originalPrice, imageUrl: img.src, inStock,
      };
    }).filter((p) => p && p.imageUrl) as Array<{
      code: string | null; name: string | null;
      price: number | null; originalPrice: number | null;
      imageUrl: string; inStock: boolean;
    }>;
  });

  console.log(`    ${products.length} producten geëxtraheerd`);

  return products
    .filter((p) => p.code) // skip producten zonder code
    .map((p) => ({
      code: p.code!,
      name: p.name ?? "Onbekend",
      price: p.price,
      originalPrice: p.originalPrice,
      imageUrl: p.imageUrl,
      inStock: p.inStock,
      catalogEdition: edition,
      filterNote,
    }));
}

function applyExcludeFilter(products: Product[], filterNote?: string): Product[] {
  if (!filterNote) return products;
  // Pak items na "behalve" en filter op naam
  const m = filterNote.match(/behalve\s+(.+?)$/i);
  if (!m) return products;
  const exclude = m[1].toLowerCase()
    .split(/\s+en\s+|\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (exclude.length === 0) return products;
  console.log(`    filter exclude: ${exclude.join(" | ")}`);
  return products.filter((p) => {
    const lower = (p.name + " " + p.code).toLowerCase();
    return !exclude.some((ex) => lower.includes(ex));
  });
}

async function main() {
  const linksTxt = await readFile("links.txt", "utf8");
  const sourceUrls = parseLinksFile(linksTxt);
  console.log(`gevonden ${sourceUrls.length} URLs in links.txt`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await login(page);

  // Verzamel alle catalog editions die we moeten verwerken
  // (uit catalog-URLs direct + uit index-URLs via tile-discovery)
  const catalogJobs: Array<{ edition: string; filterNote?: string }> = [];

  for (const src of sourceUrls) {
    if (src.type === "catalog") {
      catalogJobs.push({ edition: src.edition, filterNote: src.filterNote });
    } else {
      // index: discover sub-catalogs
      const subEditions = await discoverCatalogsFromIndex(page, src.url);
      for (const sub of subEditions) {
        catalogJobs.push({ edition: sub, filterNote: src.filterNote });
      }
    }
  }

  // Dedupe
  const seen = new Set<string>();
  const uniqueJobs = catalogJobs.filter((j) => {
    if (seen.has(j.edition)) return false;
    seen.add(j.edition);
    return true;
  });
  console.log(`\nTotaal ${uniqueJobs.length} unieke catalogs te scrapen\n`);

  const allProducts: Product[] = [];
  for (const job of uniqueJobs) {
    try {
      const items = await extractCatalogProducts(page, job.edition, job.filterNote);
      const filtered = applyExcludeFilter(items, job.filterNote);
      allProducts.push(...filtered);
    } catch (e) {
      console.error(`  FOUT bij edition ${job.edition}: ${(e as Error).message}`);
    }
  }

  await browser.close();

  // Dedupe op product code
  const codeMap = new Map<string, Product>();
  for (const p of allProducts) {
    if (!codeMap.has(p.code)) codeMap.set(p.code, p);
  }
  const unique = Array.from(codeMap.values());

  await writeFile("scripts/app4sales-products.json", JSON.stringify(unique, null, 2));
  console.log(`\n=== Totaal ${unique.length} unieke producten — opgeslagen in scripts/app4sales-products.json ===`);

  // Samenvatting per catalog
  const perCatalog = new Map<string, number>();
  for (const p of unique) perCatalog.set(p.catalogEdition, (perCatalog.get(p.catalogEdition) ?? 0) + 1);
  console.log("\nPer catalog:");
  for (const [ed, n] of Array.from(perCatalog.entries()).sort()) {
    console.log(`  edition=${ed}: ${n} producten`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
