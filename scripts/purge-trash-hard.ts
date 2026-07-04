// Definitief verwijderen van de prullenbak: producten met deletedAt gezet
// worden hard-deleted uit de DB én hun Cloudinary-foto's verwijderd.
//
// Veiligheid: een Cloudinary-asset die óók door een NIET-verwijderd product
// gebruikt wordt, blijft behouden (nooit een live foto slopen).
//
// Dry-run: npx tsx scripts/purge-trash-hard.ts
// Apply:   npx tsx scripts/purge-trash-hard.ts --apply
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function publicIdFromUrl(url: string): string | null {
  const i = url.indexOf("/upload/");
  if (i < 0) return null;
  return url.slice(i + "/upload/".length).replace(/^v\d+\//, "").replace(/\.(jpe?g|png|webp|avif|gif)$/i, "");
}
function idsFrom(images: string): string[] {
  let im: { url?: string }[] = [];
  try { im = JSON.parse(images); } catch { return []; }
  return im.map((x) => (x?.url ? publicIdFromUrl(x.url) : null)).filter((s): s is string => !!s);
}
function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

async function main() {
  const trash = await prisma.product.findMany({ where: { deletedAt: { not: null } }, select: { id: true, images: true } });
  const live = await prisma.product.findMany({ where: { deletedAt: null }, select: { images: true } });

  const liveIds = new Set(live.flatMap((p) => idsFrom(p.images)));
  const trashIds = [...new Set(trash.flatMap((p) => idsFrom(p.images)))];
  const toDelete = trashIds.filter((id) => !liveIds.has(id));
  const protectedShared = trashIds.filter((id) => liveIds.has(id));

  console.log(`\nPrullenbak-producten: ${trash.length}`);
  console.log(`Cloudinary-assets in prullenbak (uniek): ${trashIds.length}`);
  console.log(`→ te verwijderen: ${toDelete.length}`);
  console.log(`→ behouden (ook door live product gebruikt): ${protectedShared.length}${protectedShared.length ? " — " + protectedShared.slice(0, 5).join(", ") : ""}`);

  if (!APPLY) { console.log("\n(DRY-RUN — run met --apply)"); await prisma.$disconnect(); return; }

  // 1) Cloudinary-assets verwijderen (max 100 per call, CDN invalideren)
  let cldDeleted = 0, cldFailed = 0;
  for (const batch of chunk(toDelete, 100)) {
    try {
      const res = await cloudinary.api.delete_resources(batch, { invalidate: true, resource_type: "image" });
      for (const [, status] of Object.entries(res.deleted as Record<string, string>)) {
        if (status === "deleted" || status === "not_found") cldDeleted++; else cldFailed++;
      }
      process.stdout.write(`  Cloudinary batch: ${cldDeleted} verwijderd\n`);
    } catch (e) { cldFailed += batch.length; console.error(`  ✗ batch: ${e instanceof Error ? e.message : e}`); }
  }

  // 2) DB hard-delete
  const del = await prisma.product.deleteMany({ where: { deletedAt: { not: null } } });

  console.log(`\n✅ Klaar.`);
  console.log(`   Cloudinary: ${cldDeleted} verwijderd, ${cldFailed} mislukt.`);
  console.log(`   DB: ${del.count} producten definitief verwijderd.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
