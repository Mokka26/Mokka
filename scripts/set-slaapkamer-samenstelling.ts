// Zet de standaard-samenstelling per slaapkamer-type als spec.
// Jeugdkamers: kast 130 + bed 90×200 + nachtkastje + bureau, excl. matras & stoel.
// Volwassen-slaapkamers: kast + bed 160×200 + make-up tafel + poef + 2 nachtkastjes.
// Dry-run: npx tsx scripts/set-slaapkamer-samenstelling.ts   Apply: --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const JEUGD = { Samenstelling: "Kledingkast 130 cm, bed 90×200, nachtkastje, bureau", Exclusief: "Matras en stoel" };
const VOLW = { Samenstelling: "Kledingkast, bed 160×200, make-up tafel, poef, 2 nachtkastjes" };
const VOLW_SLUGS = ["sk-efes","sk-gokce","sk-nirvana","sk-urgup","kapadokyac-slaapkamer","hisar-bankstel"];

async function main() {
  const rows = await p.product.findMany({ where:{ category:"slaapkamers", deletedAt:null }, select:{id:true,slug:true,specs:true} });
  let jeugd=0, volw=0;
  for (const r of rows) {
    const isJeugd = /jeugdkamer/i.test(r.slug);
    const isVolw = VOLW_SLUGS.includes(r.slug);
    if (!isJeugd && !isVolw) continue;
    let specs: Record<string,string> = {}; try { specs = JSON.parse(r.specs||"{}"); } catch {}
    const merged = { ...specs, ...(isJeugd ? JEUGD : VOLW) };
    if (isJeugd) jeugd++; else volw++;
    if (APPLY) await p.product.update({ where:{ id:r.id }, data:{ specs: JSON.stringify(merged) } });
    else console.log(`  ${isJeugd?"jeugd":"volw "} ${r.slug}`);
  }
  console.log(`\nJeugdkamers: ${jeugd}, volwassen-slaapkamers: ${volw}`);
  console.log(APPLY ? "✅ Toegepast." : "(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
