// Verwijder lifestyle/studio reference fotos (photo-7 en photo-8) uit
// new-bolton-fresh-u-bank — die waren user-styling references die per ongeluk
// als productfoto's geupload zijn.

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

const APPLY = process.argv.includes("--apply");

async function main() {
  const p = await prisma.product.findUnique({
    where: { slug: "new-bolton-fresh-u-bank" },
    select: { id: true, images: true },
  });
  if (!p) { console.log("Niet gevonden"); return; }

  const all = parseImages(p.images);
  const keep = all.filter((i) => !/photo-7|photo-8/.test(i.url));

  console.log(`Voor: ${all.length} foto's, Na: ${keep.length} foto's`);
  console.log(`Wordt verwijderd:`);
  all
    .filter((i) => /photo-7|photo-8/.test(i.url))
    .forEach((i) => console.log(`  - ${i.url.split("/upload/")[1]}`));

  if (!APPLY) {
    console.log("\n[DRY-RUN] Run met --apply.");
    return;
  }

  await prisma.product.update({
    where: { id: p.id },
    data: { images: JSON.stringify(keep) },
  });
  console.log("\n✓ DB bijgewerkt.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
