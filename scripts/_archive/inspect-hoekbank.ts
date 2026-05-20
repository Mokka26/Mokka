import { prisma } from "@/lib/prisma";

async function main() {
  const slug = process.argv[2] ?? "bolton-riviera-hoekbank";
  const p = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, images: true, specs: true, price: true, description: true, stock: true, colorName: true, colorHex: true },
  });
  if (!p) {
    console.error(`Niet gevonden: ${slug}`);
    process.exit(1);
  }
  console.log(`Slug:  ${p.slug}`);
  console.log(`Naam:  ${p.name}`);
  console.log(`Prijs: €${p.price}`);
  console.log(`Stock: ${p.stock}`);
  console.log(`Kleur: ${p.colorName} (${p.colorHex})`);
  console.log("Specs:", p.specs);
  console.log("Foto's:");
  const imgs = JSON.parse(p.images || "[]");
  for (const [i, url] of imgs.entries()) {
    console.log(`  [${i}] ${typeof url === "string" ? url : (url.url || JSON.stringify(url))}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
