import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

async function main() {
  const sample = await prisma.product.findMany({
    where: { category: "verlichting", deletedAt: null },
    select: { slug: true, name: true, description: true, specs: true, colorName: true },
    take: 6,
  });
  for (const p of sample) {
    console.log(`\nSLUG: ${p.slug}`);
    console.log(`NAME: ${p.name}`);
    console.log(`COLOR: ${p.colorName}`);
    console.log(`SPECS: ${p.specs}`);
    console.log(`DESC: ${p.description?.slice(0, 250)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
