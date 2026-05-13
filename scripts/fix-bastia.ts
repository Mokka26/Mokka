import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
config({ path: ".env.local" });
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();

// Verwijder de "s-bank" entry (Bastia met parser-glitch)
const slug = "s-bank";
const publicIds = [
  `mokka/banken/${slug}/hero`,
  `mokka/banken/${slug}/detail-1`,
  `mokka/banken/${slug}/detail-2`,
  `mokka/banken/${slug}/detail-3`,
  `mokka/_raw/pdf/${slug}`,
];
for (const pid of publicIds) {
  try {
    const r = await cloudinary.uploader.destroy(pid, { resource_type: "image" });
    console.log(`  ${pid}: ${r.result}`);
  } catch (e) {
    console.log(`  ${pid}: skip (${(e as Error).message})`);
  }
}
try {
  await prisma.product.delete({ where: { slug } });
  console.log("  DB: removed");
} catch (e) {
  console.log(`  DB: skip (${(e as Error).message})`);
}
await prisma.$disconnect();
