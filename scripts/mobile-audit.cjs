// Mobiele audit (Playwright, iPhone 13 + SE): screenshots + metingen van overflow,
// tekstgroottes, inputs < 16px, vaste balken, touch targets en consolefouten.
// Gebruik: node scripts/mobile-audit.cjs <outdir> [--serve] [--flows-only]
//   --serve start zelf `next start` (na `npm run build`) en stopt die na afloop.
const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "mobile-audit";
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = ["/", "/eettafels", "/banken", "/aanbiedingen", "/gids", "/gids/eettafel-maat-kiezen", "/bezorging", "/showroom", "/contact", "/cart", "/checkout", "/retourneren"];

async function pageMetrics(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const all = [...document.querySelectorAll("body *")];
    const over = all
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); })
      .slice(0, 8)
      .map((e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${(typeof e.className === "string" ? e.className : "").split(" ").filter(Boolean).slice(0, 3).join(".")} [${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)}]`);
    const small = [];
    const smallInputs = [];
    for (const e of all) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const fs = parseFloat(cs.fontSize);
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && fs < 16 && e.type !== "hidden" && e.type !== "checkbox" && e.type !== "radio") smallInputs.push(`${e.tagName.toLowerCase()}[${e.name || e.id || ""}] ${fs}px`);
      if (e.children.length === 0 && e.textContent.trim().length > 1 && fs < 13 && !e.closest("[aria-hidden='true']")) small.push(`${fs}px "${e.textContent.trim().slice(0, 30)}"`);
    }
    const fixed = all
      .filter((e) => { const cs = getComputedStyle(e); return (cs.position === "fixed" || cs.position === "sticky") && e.getBoundingClientRect().height > 0; })
      .map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName.toLowerCase()}.${(typeof e.className === "string" ? e.className : "").split(" ").slice(0, 2).join(".")} top=${Math.round(r.top)} h=${Math.round(r.height)} z=${getComputedStyle(e).zIndex}`; });
    const targets = all
      .filter((e) => /^(A|BUTTON)$/.test(e.tagName) || e.getAttribute("role") === "button")
      .filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && (r.height < 32 || r.width < 32); })
      .slice(0, 10)
      .map((e) => `${e.tagName.toLowerCase()} "${(e.getAttribute("aria-label") || e.textContent.trim()).slice(0, 25)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
    const h1 = [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 60));
    const hs = [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => h.tagName).join(" ");
    const skipped = /H1(?: H1)* H3|H2 H4/.test(hs);
    return { vw, scrollWidth: document.documentElement.scrollWidth, overflow: over, smallText: [...new Set(small)].slice(0, 12), smallInputs, fixed, smallTargets: targets, h1, headingSkip: skipped, headings: hs.slice(0, 120) };
  });
}

async function run(deviceName, viewport, routes, flows) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[deviceName], viewport, locale: "nl-NL" });
  const results = {};
  for (const route of routes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
    page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));
    const t0 = Date.now();
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 120000 }).catch((e) => ({ status: () => "ERR " + e.message.slice(0, 80) }));
    const ms = Date.now() - t0;
    await page.waitForTimeout(800);
    const metrics = await pageMetrics(page);
    const name = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
    await page.screenshot({ path: path.join(OUT, `${viewport.width}-${name}.png`), fullPage: true });
    results[route] = { status: resp.status(), ms, errors: [...new Set(errors)].slice(0, 8), ...metrics };
    await page.close();
  }
  fs.writeFileSync(path.join(OUT, `${viewport.width}-results.json`), JSON.stringify(results, null, 1));
  if (flows) { try { await flows(ctx, viewport); } catch (e) { fs.writeFileSync(path.join(OUT, `${viewport.width}-flows-error.txt`), String(e)); } }
  await browser.close();
  return results;
}
const step = async (name, fn) => { try { await fn(); } catch (e) { fs.appendFileSync(path.join(OUT, "flow-steps.log"), `${name}: ${String(e).slice(0, 200)}\n`); } };

async function flows(ctx, viewport) {
  const w = viewport.width;
  // 1. Menu + zoek
  let page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
  await step("menu", async () => { const b = page.locator("header button:visible").filter({ has: page.locator("svg") }).first(); await b.click({ timeout: 5000 }); await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${w}-flow-menu.png`) }); await page.keyboard.press("Escape"); await page.waitForTimeout(400); });
  await step("cookie", async () => { const accept = page.getByRole("button", { name: /accepteren/i }).first(); await accept.click({ timeout: 5000 }); await page.waitForTimeout(400); });
  await page.screenshot({ path: path.join(OUT, `${w}-home-top-nobanner.png`) });
  await page.close();
  // 2. Categorie + filter sheet
  page = await ctx.newPage();
  await page.goto(BASE + "/eettafels", { waitUntil: "networkidle", timeout: 120000 });
  await step("filter", async () => { const filt = page.getByRole("button", { name: /filter/i }).filter({ visible: true }).first(); await filt.click({ timeout: 5000 }); await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${w}-flow-filter.png`) }); await page.keyboard.press("Escape"); await page.waitForTimeout(400); });
  const link = page.locator('a[href^="/eettafels/"]').first();
  const href = await link.getAttribute("href");
  await page.close();
  // 3. PDP + add to cart + drawer
  page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(BASE + href, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(500);
  const m1 = await pageMetrics(page);
  await page.screenshot({ path: path.join(OUT, `${w}-pdp.png`), fullPage: true });
  const add = page.getByRole("button", { name: /in winkelwagen/i }).first();
  let drawerShot = null;
  if (await add.count() && await add.isEnabled()) {
    await add.click(); await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${w}-flow-toast.png`) });
    const cartBtn = page.locator('header button[aria-controls="cart-drawer"]').first();
    if (await cartBtn.count()) { await cartBtn.click(); await page.waitForTimeout(700); drawerShot = `${w}-flow-cart-drawer.png`; await page.screenshot({ path: path.join(OUT, drawerShot) }); await page.keyboard.press("Escape"); }
  }
  await page.goto(BASE + "/checkout", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(500);
  const m2 = await pageMetrics(page);
  await page.screenshot({ path: path.join(OUT, `${w}-checkout-filled.png`), fullPage: true });
  await page.close();
  fs.writeFileSync(path.join(OUT, `${w}-flows.json`), JSON.stringify({ pdp: href, pdpMetrics: m1, checkoutMetrics: m2, errors }, null, 1));
}

// --serve: start zelf een productieserver (next start) op BASE en stop die na afloop.
async function withServer(fn) {
  if (!process.argv.includes("--serve")) return fn();
  const { spawn } = require("child_process");
  const port = new URL(BASE).port || "3000";
  const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "-p", port], { stdio: "ignore", shell: true });
  const http = require("http");
  const ready = () => new Promise((res) => { const req = http.get(BASE + "/api/health", (r) => { r.resume(); res(r.statusCode > 0); }); req.on("error", () => res(false)); });
  for (let i = 0; i < 60; i++) { if (await ready()) break; await new Promise((r) => setTimeout(r, 1000)); }
  try { await fn(); } finally {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", shell: true });
    else child.kill();
  }
}

withServer(async () => {
  const flowsOnly = process.argv.includes("--flows-only");
  const a = await run("iPhone 13", { width: 390, height: 844 }, flowsOnly ? [] : ROUTES, flows);
  const b = await run("iPhone SE", { width: 375, height: 667 }, ["/", "/eettafels", "/checkout"], null);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ iphone13: a, iphoneSE: b }, null, 1));
  console.log("klaar:", Object.keys(a).length + Object.keys(b).length, "pagina's");
}).catch((e) => { console.error(e); process.exit(1); });
