// Print alle verborgen (hidden=true, niet soft-deleted) producten.
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

async function main() {
  const hidden = await prisma.product.findMany({
    where: { hidden: true, deletedAt: null },
    select: {
      slug: true,
      name: true,
      category: true,
      price: true,
      stock: true,
      images: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`\n═══ ${hidden.length} verborgen producten ═══\n`);
  console.log("FOTO'S | CATEGORIE        | PRIJS  | NAAM");
  console.log("─".repeat(80));

  for (const p of hidden) {
    const imgs = parseImages(p.images).length;
    const cat = (p.category ?? "").padEnd(16).slice(0, 16);
    const price = `€${p.price.toFixed(0)}`.padStart(6);
    console.log(`  ${imgs.toString().padStart(3)}  | ${cat} | ${price} | ${p.name}`);
  }

  // Verdeling per categorie
  const byCat = new Map<string, number>();
  for (const p of hidden) {
    byCat.set(p.category, (byCat.get(p.category) ?? 0) + 1);
  }
  console.log("\n─── Per categorie ───");
  for (const [cat, n] of Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(20)} ${n}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
