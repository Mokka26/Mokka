// Verbeterplan 16 nov 2026 — CON-23: bronlabels.
//
//  1. Product.source (alleen admin): één schrijfwijze per leverancier.
//     "Mokka  HOME" (dubbele spatie) → "Mokka Home"; "bambi", "bss bambi" en
//     "BSS" → "BSS Bambi". Pas SOURCE_MERGE aan als je een andere naam wilt.
//     Vangrail: de levertijdtabel in scripts/set-delivery-times.ts en
//     scripts/normalize-specs.ts is gekoppeld aan source; een samenvoeging
//     wordt alleen voorgesteld als oud en nieuw daar dezelfde levertijd geven.
//  2. Leveranciersnaam in de beschrijving (klant ziet die): "van Livingfurn",
//     "vervaardigd door Livingfurn", "de Livingfurn Mason" → zonder
//     groothandelsnaam. Fabrikantnamen van stoffen (Fabb, Davis, OTE) blijven.
//     Het merk "Brix" staat in 93 namen/teksten: alleen gemeld (eigenaar beslist).
//
// Dry-run: node --env-file=.env.local --import tsx scripts/normalize-source-labels.ts
// Apply:   node --env-file=.env.local --import tsx scripts/normalize-source-labels.ts --apply
import {
  applyChanges, flag, loadProducts, printSummary, propose, replaceKeepCase, run, tidy, writeReport,
  type Change, type Flag,
} from "./catalog-shared";

const SCRIPT = "normalize-source-labels";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Genormaliseerde bron → gewenste schrijfwijze. */
const SOURCE_MERGE: Record<string, string> = {
  "mokka home": "Mokka Home",
  bambi: "BSS Bambi",
  "bss bambi": "BSS Bambi",
  bss: "BSS Bambi",
};

// Kopie van de levertijdtabel (scripts/set-delivery-times.ts) — alleen om te
// controleren dat een samenvoeging de levertijd niet verandert.
const WEKEN = "4 tot 8 weken";
const DAGEN = "Binnen 5 werkdagen";
const DELIVERY_BY_SOURCE: Record<string, string> = {
  nive: WEKEN, nevi: WEKEN, saltanat: WEKEN, mumza: WEKEN, "one world": WEKEN,
  bss: DAGEN, bambi: DAGEN, "bss bambi": DAGEN, rousseau: DAGEN, "great home": DAGEN, livingfurn: DAGEN,
};

const SUPPLIER_RULES: Array<{ re: RegExp; to: string }> = [
  { re: /,? vervaardigd door Livingfurn uit\b/g, to: ", vervaardigd uit" },
  { re: /\bvervaardigd door Livingfurn\b/g, to: "vervaardigd" },
  { re: /\b(de|De) Livingfurn (?=[A-Z])/g, to: "$1 " },
  { re: / van Livingfurn\b/g, to: "" },
  { re: /\bLivingfurn\b/g, to: "" },
];

run(async () => {
  const products = await loadProducts();
  const changes: Change[] = [];
  const flags: Flag[] = [];

  for (const p of products) {
    // 1. source
    if (p.source) {
      const target = SOURCE_MERGE[norm(p.source)] ?? (p.source !== p.source.trim().replace(/\s+/g, " ") ? p.source.trim().replace(/\s+/g, " ") : null);
      if (target && target !== p.source) {
        const before = DELIVERY_BY_SOURCE[norm(p.source)];
        const after = DELIVERY_BY_SOURCE[norm(target)];
        if (before === after) {
          propose(changes, flags, p, "source", p.source, target, ["bronlabel"]);
        } else {
          flag(flags, p, "source", p.source, `samenvoegen naar "${target}" zou de levertijdtabel veranderen — niet opgenomen`);
        }
      }
    }

    // 2. leveranciersnaam in de beschrijving
    let text = p.description;
    for (const r of SUPPLIER_RULES) text = replaceKeepCase(text, r.re, r.to);
    text = tidy(text);
    propose(changes, flags, p, "description", p.description, text, text !== p.description ? ["leverancier-in-tekst"] : []);
    if (/\bLivingfurn\b/i.test(text)) flag(flags, p, "description", text, "nog 'Livingfurn' in de tekst — handmatig");
    const brix = p.description.match(/.{0,40}\bBrix\b.{0,40}/);
    if (brix) flag(flags, p, "description", brix[0], "merk 'Brix' in de beschrijving — houden of weglaten? (eigenaar)");
  }

  const report = writeReport(SCRIPT, changes, flags, { products: products.length, changes: changes.length, flags: flags.length });
  printSummary(SCRIPT, changes, flags, report);
  await applyChanges(SCRIPT, changes);
});
