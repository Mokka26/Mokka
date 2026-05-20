import { prisma } from "@/lib/prisma";
async function main() {
  const rows = await prisma.product.findMany({
    where: { category: "hoekbanken", hidden: false },
    select: { slug: true, name: true, images: true },
    take: 30,
  });
  for (const r of rows) {
    const imgs = JSON.parse(r.images || "[]");
    const count = Array.isArray(imgs) ? imgs.length : 0;
    console.log(`${r.slug.padEnd(35)} ${count} foto's  · ${r.name}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
