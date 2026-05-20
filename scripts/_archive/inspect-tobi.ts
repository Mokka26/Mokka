import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const p = new PrismaClient();
const prod = await p.product.findUnique({ where: { slug: "tobi-bank" } });
if (!prod) {
  console.log("not found");
} else {
  const imgs: { url: string; w?: number; h?: number }[] = JSON.parse(prod.images);
  for (const i of imgs) console.log(`${i.w}x${i.h}  ${i.url}`);
}
await p.$disconnect();
