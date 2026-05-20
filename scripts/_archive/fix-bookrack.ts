import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();
const r = await prisma.product.updateMany({
  where: { slug: { contains: "book-rack" } },
  data: { category: "kasten" },
});
console.log(`${r.count} BOOK RACK producten naar 'kasten' verplaatst`);
await prisma.$disconnect();
