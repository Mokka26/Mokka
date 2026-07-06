// Herstelt ontbrekende foto's van de AHMAD-producten: de foto's staan al in
// Cloudinary (in de map van elk product), maar de images-lijst in de DB verwijst
// maar naar een deel. Dit script leest de volledige Cloudinary-map per product
// en koppelt ALLE foto's (gesorteerd op bestandsnaam).
//
// Dry-run: npx tsx scripts/resync-ahmad-images.ts   Apply: --apply
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

function folderPrefix(url: string): string | null {
  const i = url.indexOf("/upload/");
  if (i < 0) return null;
  const rest = url.slice(i + "/upload/".length).replace(/^v\d+\//, "");
  const slash = rest.lastIndexOf("/");
  return slash < 0 ? null : rest.slice(0, slash); // bv. mokka/bedden/nora-bed
}

async function listFolder(prefix: string) {
  const out: { url: string; w: number; h: number; id: string }[] = [];
  let next: string | undefined;
  do {
    const res: { resources: { secure_url: string; width: number; height: number; public_id: string }[]; next_cursor?: string } =
      await cloudinary.api.resources({ type: "upload", prefix: prefix + "/", max_results: 100, next_cursor: next });
    for (const r of res.resources) out.push({ url: r.secure_url, w: r.width, h: r.height, id: r.public_id });
    next = res.next_cursor;
  } while (next);
  // sorteer op bestandsnaam (01, 02, …)
  out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return out;
}

async function main() {
  const rows = await prisma.product.findMany({
    where: { source: { in: ["AHMAD", "ahmad"] }, deletedAt: null },
    select: { id: true, slug: true, images: true },
  });
  console.log(`AHMAD-producten: ${rows.length}\n`);

  for (const r of rows) {
    let cur: { url: string }[] = [];
    try { cur = JSON.parse(r.images); } catch { /* */ }
    const prefix = cur[0] ? folderPrefix(cur[0].url) : null;
    if (!prefix) { console.log(`  ⚠ ${r.slug}: geen Cloudinary-map af te leiden`); continue; }
    const all = await listFolder(prefix);
    const extra = all.length - cur.length;
    console.log(`  ${r.slug.padEnd(24)} nu ${String(cur.length).padStart(2)} → map ${String(all.length).padStart(2)}  (${extra > 0 ? "+" + extra + " erbij" : "compleet"})`);
    if (APPLY && all.length > 0) {
      await prisma.product.update({
        where: { id: r.id },
        data: { images: JSON.stringify(all.map((a) => ({ url: a.url, w: a.w, h: a.h }))) },
      });
    }
  }
  console.log(APPLY ? "\n✅ Toegepast." : "\n(DRY-RUN — run met --apply)");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
