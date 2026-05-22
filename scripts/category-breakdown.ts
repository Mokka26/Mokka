import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

async function main() {
  const products = await prisma.product.findMany({
    select: { category: true, hidden: true, deletedAt: true, images: true },
  });
  const byCat = new Map<string, { visible: number; hidden: number; deleted: number; visImgs: number; hiddenImgs: number; delImgs: number }>();
  for (const p of products) {
    const c = p.category;
    const entry = byCat.get(c) ?? { visible: 0, hidden: 0, deleted: 0, visImgs: 0, hiddenImgs: 0, delImgs: 0 };
    const n = parseImages(p.images).length;
    if (p.deletedAt) { entry.deleted++; entry.delImgs += n; }
    else if (p.hidden) { entry.hidden++; entry.hiddenImgs += n; }
    else { entry.visible++; entry.visImgs += n; }
    byCat.set(c, entry);
  }
  console.log("\nCATEGORIE       ZICHTB.  VERB.  DEL  VIS-IMGS  HID-IMGS  DEL-IMGS");
  console.log("─".repeat(76));
  for (const [cat, e] of Array.from(byCat.entries()).sort()) {
    console.log(`  ${cat.padEnd(15)} ${e.visible.toString().padStart(6)}  ${e.hidden.toString().padStart(5)}  ${e.deleted.toString().padStart(3)}  ${e.visImgs.toString().padStart(8)}  ${e.hiddenImgs.toString().padStart(8)}  ${e.delImgs.toString().padStart(8)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
