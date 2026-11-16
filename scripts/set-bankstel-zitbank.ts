// Extra 1-zitsbank bij bankstellen: zet zitbankMode = "optional" en
// zitbankPrice = ZITBANK_PRICE voor alle (niet-verwijderde) producten in de
// categorie "bankstellen". De klant kan dan op de productpagina één extra
// 1-zitsbank in dezelfde stof en kleur bijbestellen.
//
// - Standaard DRY-RUN: toont per product de huidige en nieuwe waarde en
//   wijzigt niets.
// - Pas met --apply wordt geschreven. Eerst gaat er een back-up van de oude
//   waarden naar scripts/reports/backup-set-bankstel-zitbank-<tijd>.json.
// - Raakt alleen zitbankMode en zitbankPrice; nooit price, listPrice, stock,
//   hidden, deliveryTime of andere velden. Verborgen producten krijgen de
//   optie ook (blijven verborgen).
// - Vereist de migratie 20261116120000_product_zitbank op de database.
//
// Dry-run: node --env-file=.env.local --import tsx scripts/set-bankstel-zitbank.ts
// Apply:   node --env-file=.env.local --import tsx scripts/set-bankstel-zitbank.ts --apply
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Toeslag in euro's (incl. btw) voor één extra 1-zitsbank. */
const ZITBANK_PRICE = 250;
const ZITBANK_MODE = "optional";
const CATEGORY = "bankstellen";

const APPLY = process.argv.includes("--apply");
const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const db = new PrismaClient();

const fmt = (mode: string | null, price: number | null) => `${mode ?? "—"} / ${price == null ? "—" : `€ ${price}`}`;

async function main(): Promise<void> {
  const products = await db.product.findMany({
    where: { category: CATEGORY, deletedAt: null },
    select: { id: true, slug: true, name: true, hidden: true, zitbankMode: true, zitbankPrice: true },
    orderBy: { name: "asc" },
  });

  const todo = products.filter((p) => p.zitbankMode !== ZITBANK_MODE || p.zitbankPrice !== ZITBANK_PRICE);

  console.log(`${products.length} bankstellen gevonden (deletedAt = null), ${todo.length} te wijzigen.\n`);
  for (const p of products) {
    const changed = todo.includes(p);
    const tag = p.hidden ? " [verborgen]" : "";
    console.log(
      `${changed ? "*" : " "} ${p.name}${tag} (${p.slug}): ${fmt(p.zitbankMode, p.zitbankPrice)} → ${fmt(ZITBANK_MODE, ZITBANK_PRICE)}`,
    );
  }

  if (!APPLY) {
    console.log(`\nDry-run: er is niets gewijzigd. Toepassen: node --env-file=.env.local --import tsx scripts/set-bankstel-zitbank.ts --apply`);
    return;
  }
  if (todo.length === 0) {
    console.log("\nNiets te doen.");
    return;
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(REPORT_DIR, `backup-set-bankstel-zitbank-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      todo.map((p) => ({ id: p.id, slug: p.slug, zitbankMode: p.zitbankMode, zitbankPrice: p.zitbankPrice })),
      null,
      2,
    ),
  );
  console.log(`\nBack-up: ${backupPath}`);

  const result = await db.product.updateMany({
    where: { id: { in: todo.map((p) => p.id) }, category: CATEGORY, deletedAt: null },
    data: { zitbankMode: ZITBANK_MODE, zitbankPrice: ZITBANK_PRICE },
  });
  console.log(`${result.count} bankstellen bijgewerkt. De productpagina's tonen de optie na de volgende revalidatie.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
