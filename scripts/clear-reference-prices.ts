// Verbeterplan nov 2026 — JUR-1 (Omnibus/Prijzenwet art. 6a): doorgestreepte
// "adviesprijzen" zonder aantoonbare bron weghalen — op het product (listPrice)
// én per maat (sizeVariants[].listPrice). Eerst een back-up (JSON) zodat een
// later wél onderbouwde adviesprijs per product terug te zetten is.
//
// Dry-run: npx tsx --env-file=.env.local scripts/clear-reference-prices.ts <backup.json>
// Apply:   npx tsx --env-file=.env.local scripts/clear-reference-prices.ts <backup.json> --apply
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BACKUP = process.argv[2];
const APPLY = process.argv.includes("--apply");

type SizeVariant = { label: string; price?: number; listPrice?: number; [k: string]: unknown };

async function main() {
  if (!BACKUP || BACKUP.startsWith("--")) throw new Error("Geef een pad voor de back-up (JSON) mee");
  const rows = await db.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, listPrice: true, sizeVariants: true },
  });
  const backup: Array<{ id: string; slug: string; listPrice: number | null; sizeVariants: string | null }> = [];
  const updates: Array<{ id: string; data: { listPrice?: null; sizeVariants?: string } }> = [];

  for (const r of rows) {
    const data: { listPrice?: null; sizeVariants?: string } = {};
    if (r.listPrice !== null) data.listPrice = null;
    if (r.sizeVariants) {
      try {
        const v = JSON.parse(r.sizeVariants) as unknown;
        if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "listPrice" in x)) {
          data.sizeVariants = JSON.stringify(
            (v as SizeVariant[]).map(({ listPrice: _drop, ...rest }) => rest),
          );
        }
      } catch {
        /* kapotte JSON laten we staan; meldt normalize-delivery-and-prices */
      }
    }
    if (Object.keys(data).length) {
      backup.push({ id: r.id, slug: r.slug, listPrice: r.listPrice, sizeVariants: r.sizeVariants });
      updates.push({ id: r.id, data });
    }
  }

  console.log(`${rows.length} producten bekeken, ${updates.length} met een adviesprijs.`);
  writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
  console.log(`Back-up geschreven: ${BACKUP}`);
  if (!APPLY) {
    console.log("(DRY-RUN — niets gewijzigd. Run met --apply.)");
    return;
  }
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await db.$transaction(batch.map((u) => db.product.update({ where: { id: u.id }, data: u.data })));
  }
  console.log(`✓ Adviesprijzen weggehaald bij ${updates.length} producten.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
