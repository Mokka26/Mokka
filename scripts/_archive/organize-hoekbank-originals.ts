// Organiseer alle hoekbank-originelen uit public/wetransfer-folders naar
// photos-todo/<slug>/originals/  + maak studio/ lifestyle/ folders +
// WERKDOCUMENT.md per bank.
//
// Run:
//   DATABASE_URL=$(grep "^DATABASE_URL" .env.local | cut -d= -f2-) \
//     npx tsx scripts/organize-hoekbank-originals.ts
//
// --dry-run om alleen rapport te zien zonder bestanden te kopiëren.

import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = process.cwd();

// Map slug → naam-fragment om wetransfer-folder te vinden
// (folders heten bv "Hoekbank Bolton (Riviera) cc")
const SLUG_TO_FRAGMENT: Record<string, string> = {
  "bolton-riviera-hoekbank":         "Bolton (Riviera)",
  "california-kemer-hoekbank":       "California (Kemer)",
  "california-magic-hoekbank":       "California (Magic)",
  "fortes-kemer-hoekbank":           "Fortes (Kemer)",
  "mila-monolith-hoekbank":          "Mila (Monolith)",
  "new-bolton-kronos-hoekbank":      "New Bolton (Kronos)",
  "new-bolton-riviera-hoekbank":     "New Bolton (Riviera)",
  "rafaello-relax-decowit-hoekbank": "Rafaello (Relax_decowit)",
  "rosso-soro-hoekbank":             "Rosso (Soro)",
  "star-kemer-hoekbank":             "Star (Kemer)",
  "jolly-kemer-hoekbank":            "Jolly (Kemer)",
  "yola-monolith-hoekbank":          "Yola (Monolith)",
  // anna-hoekbank: geen lokale originelen
};

async function findOriginalsFolder(fragment: string): Promise<string | null> {
  const wetransferRoots = (await fs.readdir(path.join(ROOT, "public"))).filter((f) =>
    f.startsWith("wetransfer")
  );
  for (const root of wetransferRoots) {
    const rootPath = path.join(ROOT, "public", root);
    const stack = [rootPath];
    while (stack.length) {
      const dir = stack.pop()!;
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const full = path.join(dir, e.name);
        if (e.name.includes(fragment)) return full;
        stack.push(full);
      }
    }
  }
  return null;
}

async function organizeOne(slug: string, fragment: string): Promise<{ slug: string; status: string; count: number }> {
  const srcFolder = await findOriginalsFolder(fragment);
  if (!srcFolder) return { slug, status: "GEEN-LOKALE-FOLDER", count: 0 };

  const todoDir = path.join(ROOT, "photos-todo", slug);
  const originalsDir = path.join(todoDir, "originals");
  const studioDir = path.join(todoDir, "studio");
  const lifestyleDir = path.join(todoDir, "lifestyle");

  const entries = (await fs.readdir(srcFolder)).filter((f) => /\.(png|jpe?g)$/i.test(f));

  if (DRY_RUN) {
    return { slug, status: `DRY  (zou ${entries.length} files kopiëren)`, count: entries.length };
  }

  await fs.mkdir(originalsDir, { recursive: true });
  await fs.mkdir(studioDir, { recursive: true });
  await fs.mkdir(lifestyleDir, { recursive: true });

  for (const file of entries) {
    await fs.copyFile(path.join(srcFolder, file), path.join(originalsDir, file));
  }

  // Schrijf WERKDOCUMENT.md per bank
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { name: true, specs: true },
  });
  const specs = product?.specs ? JSON.parse(product.specs) : {};
  const md = `# ${product?.name ?? slug} — Foto-werkdocument

## Specs
- Serie: ${specs.Serie ?? "—"}
- Stoffering: ${specs.Stoffering ?? "—"}
- Levertijd: ${specs.Levertijd ?? "—"}

## Folders
- \`originals/\` — ${entries.length} brongebestanden (al gekopieerd vanuit \`${path.basename(srcFolder)}\`)
- \`studio/\` — drop hier de bewerkte **studio-foto's** (bone bg #EEEAE3)
- \`lifestyle/\` — drop hier de bewerkte **woonkamer-foto** (1x volstaat)

## Naming
- studio: \`studio-1.jpg\`, \`studio-2.jpg\`, ... in gewenste volgorde (studio-1 wordt hero)
- lifestyle: \`lifestyle-1.jpg\`

## Designer studio-instellingen (per foto)
1. Background remove
2. Solid bg color \`#EEEAE3\`
3. Drop-shadow (soft, 30%, offset 20px below)
4. Square crop 1:1
5. Export 2000×2000 JPG quality 85%

## Designer lifestyle-prompt
Pak de mooiste hero-foto. Replace background met AI, prompt:

> *"minimalist wabi-sabi living room with light oak wood floor, warm linen curtains, soft natural daylight, neutral plaster walls in warm bone tone, terracotta accent throw pillow, premium editorial interior photography, photorealistic"*

Square crop 1:1, hoge resolutie.

## Import naar site (na Designer-werk)
\`\`\`
DATABASE_URL=$(grep "^DATABASE_URL" .env.local | cut -d= -f2-) \\
  npx tsx scripts/import-hoekbank-photos.ts ${slug}
\`\`\`
Volgorde DB: [studio-1, lifestyle-1, studio-2..N]
`;
  await fs.writeFile(path.join(todoDir, "WERKDOCUMENT.md"), md);

  return { slug, status: "OK", count: entries.length };
}

async function main() {
  console.log(`\n═══ Organiseer hoekbank-originelen ═══`);
  console.log(`  Dry-run: ${DRY_RUN}\n`);

  const allSlugs = await prisma.product.findMany({
    where: { category: "hoekbanken", hidden: false },
    select: { slug: true },
  });

  const results: { slug: string; status: string; count: number }[] = [];

  for (const { slug } of allSlugs) {
    const fragment = SLUG_TO_FRAGMENT[slug];
    if (!fragment) {
      results.push({ slug, status: "GEEN-MAPPING", count: 0 });
      continue;
    }
    const r = await organizeOne(slug, fragment);
    results.push(r);
    console.log(`  ${r.status.padEnd(28)} [${String(r.count).padStart(2)}]  ${slug}`);
  }

  const ok = results.filter((r) => r.status === "OK" || r.status.startsWith("DRY")).length;
  const total = results.reduce((s, r) => s + r.count, 0);
  console.log(`\n✓ ${ok}/${results.length} banken georganiseerd, ${total} bestanden totaal.`);

  const missing = results.filter((r) => !r.status.startsWith("OK") && !r.status.startsWith("DRY"));
  if (missing.length) {
    console.log(`\n⚠ Ontbreekt lokaal (later via Cloudinary):`);
    missing.forEach((m) => console.log(`   - ${m.slug}  (${m.status})`));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
