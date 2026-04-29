import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const NEW_IMAGE = {
  url: "https://res.cloudinary.com/diaksxzey/image/upload/v1777427442/copy_of_01_b7b8f8.jpg",
  w: 2458,
  h: 2458,
};

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { contains: "Tilda", mode: "insensitive" } },
    select: { id: true, slug: true, name: true, images: true },
  });
  console.log(`Gevonden: ${products.length} match(es)`);
  for (const p of products) {
    console.log(`  - ${p.name} (slug: ${p.slug})`);
  }

  const tilda = products.find((p) => /grijs/i.test(p.name)) ?? products[0];
  if (!tilda) {
    console.error("Geen Tilda Grijs product gevonden");
    process.exit(1);
  }

  console.log(`\nUpdaten: ${tilda.name}`);

  let existing: unknown[] = [];
  try {
    const parsed = JSON.parse(tilda.images);
    if (Array.isArray(parsed)) existing = parsed;
  } catch {}

  // Filter de nieuwe URL eruit als die al ergens stond, daarna voeg 'm vooraan toe
  const filtered = existing.filter((item) => {
    if (typeof item === "string") return item !== NEW_IMAGE.url;
    if (item && typeof item === "object" && "url" in item) return (item as { url: string }).url !== NEW_IMAGE.url;
    return true;
  });
  const updated = [NEW_IMAGE, ...filtered];

  await prisma.product.update({
    where: { id: tilda.id },
    data: { images: JSON.stringify(updated) },
  });

  console.log(`Klaar — ${updated.length} foto's, hoofdfoto is nu de geleverde URL`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
