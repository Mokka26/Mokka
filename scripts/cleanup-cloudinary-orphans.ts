// Verwijdert Cloudinary-assets waar NIETS meer naar verwijst. Dubbel veilig:
// 1) alleen ids uit de eerder opgeslagen wees-lijst (_orphans.json), én
// 2) her-verificatie op het moment zelf: alles wat een product (ook verborgen/
//    prullenbak) of de deletedImage-tabel nu refereert, wordt overgeslagen.
//
// Dry-run: npx tsx scripts/cleanup-cloudinary-orphans.ts
// Apply:   npx tsx scripts/cleanup-cloudinary-orphans.ts --apply
import { config as loadEnv } from "dotenv"; loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function publicIdFromUrl(url: string): string | null {
  const i = url.indexOf("/upload/");
  if (i < 0) return null;
  let rest = url.slice(i + 8).replace(/^v\d+\//, "");
  const first = rest.split("/")[0];
  if (first.includes(",") || /^(c_|w_|h_|q_|f_|e_|b_|g_|ar_|dpr_)/.test(first)) {
    rest = rest.slice(first.length + 1).replace(/^v\d+\//, "");
  }
  return rest.replace(/\.[a-zA-Z0-9]+$/, "");
}

async function main() {
  const candidates: string[] = JSON.parse(readFileSync("C:/Users/konia/skimport2/_orphans.json", "utf8"));

  // VERSE referentie-set opbouwen (admin kan sinds de audit foto's gewijzigd hebben)
  const used = new Set<string>();
  const products = await prisma.product.findMany({ select: { images: true } });
  for (const p of products) {
    try {
      for (const it of JSON.parse(p.images) as (string | { url: string })[]) {
        const pid = publicIdFromUrl(typeof it === "string" ? it : it?.url ?? "");
        if (pid) used.add(pid);
      }
    } catch { /* */ }
  }
  for (const d of await prisma.deletedImage.findMany({ select: { publicId: true } })) used.add(d.publicId);

  const toDelete = candidates.filter((id) => !used.has(id));
  const skipped = candidates.length - toDelete.length;
  console.log(`Kandidaten: ${candidates.length} | nu tóch in gebruik (overgeslagen): ${skipped} | te verwijderen: ${toDelete.length}`);

  if (!APPLY) {
    console.log("\nDry-run. Run met --apply om te verwijderen.");
    await prisma.$disconnect(); process.exit(0);
  }

  let deleted = 0, failed = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    try {
      const res: { deleted: Record<string, string> } = await cloudinary.api.delete_resources(batch, { invalidate: true });
      const ok = Object.values(res.deleted).filter((v) => v === "deleted").length;
      deleted += ok; failed += batch.length - ok;
      process.stdout.write(`\r${deleted}/${toDelete.length} verwijderd…`);
    } catch { failed += batch.length; }
  }
  console.log(`\n✅ Verwijderd: ${deleted} | mislukt/niet gevonden: ${failed}`);
  await prisma.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
