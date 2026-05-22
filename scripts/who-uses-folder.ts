// Voor een gegeven Cloudinary-folder: welke producten verwijzen ernaar?
// Run: npx tsx scripts/who-uses-folder.ts mokka/bedden/bohemella

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const folder = process.argv[2];
if (!folder) {
  console.log("Usage: npx tsx scripts/who-uses-folder.ts <folder-path>");
  process.exit(1);
}

async function main() {
  const products = await prisma.product.findMany({
    where: { images: { contains: folder } },
    select: { slug: true, name: true, hidden: true, deletedAt: true, category: true },
  });
  console.log(`\n${products.length} product(en) verwijzen naar "${folder}":\n`);
  for (const p of products) {
    const status = p.deletedAt ? "DELETED" : p.hidden ? "HIDDEN" : "ZICHTBAAR";
    console.log(`  [${status.padEnd(9)}] ${p.category.padEnd(15)} ${p.slug.padEnd(40)} ${p.name}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
