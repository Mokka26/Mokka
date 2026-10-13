# Catalogusdata — scripts, audit en opschoning

Laatste opschoning: 2026-10-12. Alle scripts draaien met `npx tsx scripts/<naam>.ts`
en laden `.env.local` zelf. Datawijzigingen altijd eerst als dry-run, dan `--apply`.
De scripts raken **nooit** `hidden`, `price`, `listPrice`, `stock` of `featured`
en verwijderen niets; verborgen producten blijven verborgen.

## Pure helpers: `lib/specs.ts`

Geen Prisma, bruikbaar in scripts, Server Components en de Shopping-feed.

| Functie | Doel |
|---|---|
| `parseSpecs(json)` | `Product.specs` (JSON-string) → `Record<string,string>` |
| `normalizeSpecKeys(specs)` | typefouten/aliassen herstellen, `Categorie` en `Levertijd` weg (staan in eigen kolom), vaste volgorde: Serie, Afmetingen, Materiaal, Kleur, Afwerking, … , Artikelnummer, EAN |
| `parseDimensions(text, category?)` | alle aangetroffen notaties → `{ w, wMax?, d, h, diameter }`; B/D/H, L/B/H, Ø, `x`/`×`, met/zonder cm, komma-decimalen, `180/220×90` (uitschuiftafel). Kale getallen: spiegels/wandlampen = B × H (× D), overig = B × D (× H). Meerdere maten of een los getal → `null` |
| `formatDimensions(dims)` | canoniek: `B 120 × D 60 × H 45 cm`, `B 180/220 × D 90 cm`, `Ø 120 × H 75 cm` |
| `isCanonicalDimensions(text)` | staat de tekst al in dat formaat? |
| `plausibleDimensions(category, dims)` | hoogte-plafond per categorie (bank van 265 cm hoog = onleesbaar) |
| `dimensionContext(category, dims)` | eettafels → "Plaats voor 6 tot 8 personen"; banken → zitbreedte + minimale kamerbreedte; bedden → matrasmaat. Voor de PDP (CLAUDE.md §3) |
| `COLOR_HEX`, `colorHexFor(naam)` | kleurnaam → swatch (zelfde basis als `scripts/group-color-variants.ts`, aangevuld met LivingFurn/Engelse namen) |
| `deriveMaterial(text)` | woordenlijst (eiken, mangohout, teak, acacia, marmer, travertin, glas, metaal, staal, fluweel, bouclé, leer, stof, rotan, MDF, keramiek); alleen bij precies één treffer |
| `productTypeLabel(category)`, `nameHasType(category, naam)` | producttype in enkelvoud (`eetkamerstoelen` → `Eetkamerstoel`) en of de naam het al bevat |
| `findProductCode(naam)`, `stripProductCode(naam)` | leverancierscodes (ZB-5635, QL10648, GH1018, ART1017, MT-97, CW003, 15564D2-E, 056) |
| `slugify(s)` | lowercase slug zonder diakrieten |

## Scripts

### `scripts/audit-catalog.ts` (alleen-lezen, herhaalbaar)

```
npx tsx scripts/audit-catalog.ts              # tekst, 5 voorbeelden per punt
npx tsx scripts/audit-catalog.ts --examples=0
npx tsx scripts/audit-catalog.ts --json       # alle tellingen + max 25 voorbeeld-slugs per punt
```

Telt per categorie en bron (zichtbaar/verborgen) en per kwaliteitspunt: zonder
foto, 1 foto, eerste foto portrait / kleiner dan 800 px, zonder afmetingen,
afwijkend formaat, onleesbaar, meerdere maten, zonder materiaal, code in naam,
Engelse slug, naam > 70 tekens, zonder specs, `Categorie`/`Levertijd` in specs,
prijs 0, listPrice < prijs, zonder levertijd, voorraad 0, maatvariant zonder
prijs, dubbele namen, kleurnaam zonder hex, kleurgroep zonder kleurnaam,
kleurgroep met één zichtbaar lid, gedeelde beschrijvingen.

### `scripts/normalize-specs.ts` (dry-run / `--apply`)

Voor alle niet-verwijderde producten (ook verborgen):

1. `specs.Afmetingen` → canoniek formaat; ontbreekt de maat, dan afleiden uit
   naam, beschrijving of slug — alleen bij een eenduidig patroon (`120x60x45`,
   `160×200`, `Ø 120`). Onleesbare of meervoudige maten blijven staan en worden gemeld.
2. `specs.Materiaal` afleiden uit de naam (alle categorieën) of de beschrijving
   (alleen bekleding/armaturen: stoelen, banken, poefs, lampen) bij precies één treffer.
3. Spec-sleutels normaliseren (zie `normalizeSpecKeys`).
4. `deliveryTime` vullen waar leeg: per bron (zelfde tabel als
   `scripts/set-delivery-times.ts`), anders de meest voorkomende waarde van die bron.
5. `colorHex` vullen waar `colorName` bekend is.

Resultaat 2026-10-12 (1.467 producten, 1.425 rijen bijgewerkt):

| Wijziging | Aantal |
|---|---:|
| Afmetingen genormaliseerd | 269 |
| Afmetingen afgeleid uit naam/beschrijving/slug | 0 (geen eenduidige patronen aanwezig) |
| Afmetingen onleesbaar gelaten | 6 (`313cm`, `3 × 30 cm`, `165cm x 370cm x 265cm`, `5×90×2`, …) |
| Afmetingen met meerdere maten gelaten | 7 (One World "Matrasmaten: …") |
| Materiaal afgeleid | 6 (4 uit naam, 2 uit beschrijving) |
| Spec-sleutel `Categorie` verwijderd | 826 |
| Spec-sleutel hernoemd (`opsteling Kiezen` → `Opstelling`) | 1 |
| Levertijd gezet | 24 (NIVE 14, Twenty Bedding 5, MUMZA 4, Mokka catalogus 1) |
| colorHex aangevuld | 98 |
| colorHex onbekend gelaten | 9 (`colorName` = "Kala" is een serienaam, geen kleur — LivingFurn) |
| Gedeelde beschrijvingen (gemeld, niet gewijzigd) | 92 groepen / 302 producten, o.a. 5 plafondlampen "Met de Ceiling plafondlamp…" |

Let op: 9 producten hadden alleen `Categorie` in specs; hun specs zijn nu leeg
(`{}`) en tellen in de audit als "zonderSpecs". Dat is geen dataverlies.

### `scripts/rename-greathome-products.ts` (dry-run / `--apply`)

Kandidaten: producten met een leverancierscode in naam of slug (Great Home,
Mokka catalogus). Hernoemt naar `<Type> <Model/Code> <kleur> <maat>`:

- eetkamerstoelen: `Londen ZB-5635 Eetkamerstoel Crème` → `Eetkamerstoel Londen crème`;
  `Alenya ZB-5620 Eetkamerstoel Zwart onderstel Taupe` → `Eetkamerstoel Alenya taupe, zwart onderstel`
  (twee kleuren zonder "onderstel" alleen als de slug `<kleur>-legs` bevestigt;
  de onderstelkleur komt uit de slug als die preciezer is: `l-brown-legs` = lichtbruin);
- lampen: `Plafondlamp Ø 45 Goud GH1106` → `Plafondlamp GH1106 goud Ø 45 cm`;
  `Plafondlamp Bruin QL1090` (slug `…rond-orbits`) → `Plafondlamp Orbits QL1090 bruin`;
- spiegels: `Wandspiegel Spiegel 120×120 Goud` (slug `…mt-97-gold-line…`) → `Wandspiegel met verlichting Gold Line 120 × 120 cm`;
  modelnaam uit de slug, vorm (ovaal/vierkant) als uitvoering.

Naamconventie (vastgelegd 2026-10-12, tweede ronde):

1. Zou een naam dubbel worden, of delen meerdere producten dezelfde code
   (zelfde model in meerdere kleuren), dan komt de leverancierscode als
   onderscheider achter het type/model: `Plafondlamp QL10675 zilver`.
2. `Wandspiegel Spiegel …` → type `Wandspiegel` (`Wandspiegel met verlichting` bij led).
3. De slug is `slugify(naam)` en begint dus altijd met het Nederlandse type
   (`ceiling-lamp-…` → `plafondlamp-…`, `wall-decoration-…`/`mirror-…` →
   `wandspiegel-…`, `table-lamp-…` → `tafellamp-…`, `floor-lamp-…` →
   `vloerlamp-…`, `chair-…` → `eetkamerstoel-…`).
4. Kleur in kleine letters, na type en model/code.
5. Ontbreekt de kleur in naam en specs, dan uit de slug-tokens
   (`gold`/`black`/`silver`/`white`/`brown`/`smoke`/`clear` → goud/zwart/zilver/wit/bruin/rookglas/helder).
6. `Feather Lamp …` (slug `…wall-led-lamp…`) → `Wandlamp Feather <kleur>`;
   `Baron stoel` → `Eetkamerstoel Baron <kleur uit slug>`.
7. Een lamp zonder kleur maar met modelnaam krijgt altijd de code
   (`Plafondlamp Nova GH1016`, `Tafellamp Travertine ART1026 32 × 25 cm`).

Per hernoemd product: nieuwe slug (`slugify(naam)`, bij botsing suffix met de
code), `SlugRedirect` oude slug → product, code naar `specs.Artikelnummer`
(als leeg) en maat uit de naam naar `specs.Afmetingen` (als leeg). Cloudinary-
URL's blijven ongewijzigd (public_id bevat de oude slug; dat is prima).
Voor **alle** kandidaten, ook twijfelgevallen, wordt `specs.Artikelnummer`
gevuld (dat is de `g:mpn` in de feed).

Conservatief: niet hernoemd als type of kleur niet eenduidig is of als de
nieuwe naam ook mét code dubbel zou worden. Namen en slugs die al aan de
conventie voldoen worden overgeslagen ("al conform").

Resultaat ronde 1 (2026-10-12): 230 kandidaten, **91 hernoemd** (+ 91
SlugRedirect-rijen), **230× Artikelnummer gevuld**, 139 twijfelgevallen.
Resultaat ronde 2 (2026-10-12, naamconventie hierboven): 139 kandidaten,
**124 hernoemd** (+ 124 SlugRedirect-rijen, 123 daarvan met code als
onderscheider), 0 specs-aanvullingen (al gevuld in ronde 1), **15
twijfelgevallen** (lijst onderaan). Een derde run meldt 0 wijzigingen
(123 al conform, 15 twijfel).

`SlugRedirect` wordt door de PDP-route gelezen (`lib/slug-redirect.ts`,
`findRedirectTarget`): een oude slug geeft een 308 naar de canonieke
`/<categorie>/<nieuwe slug>`; verborgen of verwijderde producten redirecten niet.

## Vóór / ná (zichtbaar · verborgen)

Totaal ongewijzigd: 1.173 zichtbaar, 294 verborgen, 0 verwijderd.

| Punt | Vóór zichtbaar | Vóór verborgen | Ná zichtbaar | Ná verborgen |
|---|---:|---:|---:|---:|
| specsMetCategorie | 814 | 11 | 0 | 0 |
| specsMetLevertijd | 1 | 0 | 0 | 0 |
| afmetingenAfwijkendFormaat | 262 | 2 | 1 | 0 |
| afmetingenOnleesbaar | 10 | 0 | 4 | 0 |
| afmetingenMeerdereMaten | 7 | 0 | 7 | 0 |
| zonderAfmetingen | 422 | 8 | 422 | 8 |
| zonderMateriaal | 336 | 13 | 330 | 13 |
| codeInNaam | 180 | 0 | 125 | 0 |
| engelseSlug | 466 | 95 | 381 | 95 |
| kleurnaamZonderHex | 51 | 56 | 0 | 9 |
| zonderLevertijd | 18 | 6 | 0 | 0 |
| dubbeleNaam | 14 | 4 | 14 | 4 |
| kleurgroepZonderKleurnaam | 14 | 0 | 14 | 0 |
| kleurgroepMetEenZichtbaarLid | 9 | 0 | 9 | 0 |
| eenFoto | 500 | 3 | 500 | 3 |
| eersteFotoPortrait | 58 | 9 | 58 | 9 |
| eersteFotoKlein | 17 | 8 | 17 | 8 |
| gedeeldeBeschrijving | 102 | 200 | 102 | 200 |
| voorraad0 | 22 | 2 | 22 | 2 |
| prijs0 | 0 | 27 | 0 | 27 |
| naamLangerDan70 | 2 | 0 | 2 | 0 |
| maatvariantZonderPrijs | 1 | 0 | 1 | 0 |
| zonderSpecs | 1 | 0 | 9 | 1 |

Het overgebleven afwijkende formaat is `tafel-tavira-120-cm-rond-cement-ecru`
(`B 120 × D 77 × H 120 cm`: hoogte en diepte lijken verwisseld — handmatig nakijken).

### Niet op te lossen met data-scripts (eigenaar / andere engineers)

- 422 producten zonder afmetingen: de bron (naam, beschrijving, slug) bevat geen
  maat; dat zijn vooral Great Home-stoelen en -lampen en complete sets.
- 330 zonder materiaal: geen eenduidig materiaalwoord in naam/beschrijving.
- 58 portrait- en 17 kleine eerste foto's; 500 producten met één foto.
- 14 dubbele namen (o.a. `Lizzy Salontafel Flintstone` ×2) en de 125 resterende
  codes in namen: zie twijfellijst.
- 9× `colorName` "Kala" (LivingFurn-serie, geen kleur) — verborgen producten.

## Twijfelgevallen hernoeming (niet aangepast)

Stand na ronde 2 (2026-10-12), 15 producten. Eigenaar kiest in de admin.

### 6× naam zou dubbel zijn, ook met code (zelfde naam én code op twee slugs)

- Plafondlamp Zilver QL10638 (`ceiling-lamp-ql10638-3160-600-silver` en `…-ql10638-1-3160-600-silver`)
- Plafondlamp Goud QL10637 (`ceiling-lamp-ql10637-3160-600-gold` en `…-ql10637-1-3160-600-gold`)
- Baroni ZB-5686 Eetkamerstoel Grijs (`chair-baroni-zb-5686-grey` en `…-grey-fy2415-10`)

### 4× kleur ontbreekt (geen kleur in naam, specs of slug)

- Plafondlamp GH1115 (`ceiling-lamp-gh1115-80-80-39`), Plafondlamp GH1114 (`ceiling-lamp-gh1114-60-60-39`)
- Plafondlamp QL10617 (`ceiling-lamp-ql10617-6083-d600`), Plafondlamp QL10618 (`ceiling-lamp-ql10618-6083-d1000-430`)

### 2× maat in naam onleesbaar

- Wandspiegel Spiegel 5×90×2 Goud / Zwart (`mirror-rosa-gold-mt71-157-5x90x2`, `mirror-rosa-black-mt72-157-5x90x2`): 157,5 × 90 × 2?

### 2× uitvoering (aantal × maat?) niet eenduidig

- Plafondlamp 3×30 Crème GH1007 / GH1008 (`ceiling-lamp-organic-cream-resin-gh100[78]-[lr]-3x30`)

### 1× alleen onderstelkleur bekend; stofkleur ontbreekt

- Dubai ZB-5576 Eetkamerstoel Bruin onderstel (`chair-dubai-zb-5576-brown-legs-fy2415-8-brown`)

Historie ronde 1 (ter referentie; de meeste hieronder zijn in ronde 2 alsnog
hernoemd met de code als onderscheider):


### 111× naam zou dubbel zijn: … (modelnaam/afmeting nodig)

- Wandspiegel 15564D2-E Spiegel 80×140×3 (`wall-decoration-15564d2-e-with-led-80x140x3-7`)
- Plafondlamp Zwart QL10648 (`ceiling-lamp-ql10648-3162-1200-300-black`)
- Plafondlamp Bruin QL1090 (`ceiling-lamp-ql1090-brown-smoke-7331-3-3-rond-orbits`)
- Wandspiegel 1-25131YD2-E Spiegel 80×140×3 (`wall-decoration-1-25131yd2-e-with-led-80x140x3-7`)
- Vloerlamp Zwart QL10629 (`floor-lamp-ql10629-sh40-black-silver`)
- Plafondlamp Zilver QL10644 (`ceiling-lamp-ql10644-3161-600-silver-clear`)
- Plafondlamp Ø 45 Goud GH1106 (`ceiling-lamp-gh1106-45-gold`)
- Plafondlamp Ø 60 Goud GH1107 (`ceiling-lamp-gh1107-60-gold`)
- Plafondlamp Goud GH1111 (`ceiling-lamp-gh1111-900-400-gold`)
- Plafondlamp Goud 056 (`ceiling-lamp-056-540-s-gold`)
- Wandspiegel Spiegel 120×120 (`mirror-with-light-mt-98-cw001-clear-120x120`)
- Plafondlamp Zwart QL10668 (`ceiling-lamp-ql10668-7003-8-black`)
- Dubai ZB-5576 Eetkamerstoel Bruin onderstel Taupe (`chair-dubai-zb-5576-l-brown-legs-fy2415-6-taupe`)
- Wandspiegel 15558D-E Spiegel 120×120×3 (`wall-decoration-15558d-e-with-led-120x120x3-7`)
- Wandspiegel 15557D-E Spiegel 120×120×3 (`wall-decoration-15557d-e-with-led120x120x3-7`)
- Wandspiegel 15565D2-E Spiegel 80×140×3 (`wall-decoration-15565d2-e-with-led-80x140x3-7`)
- Plafondlamp Zilver QL10675 (`ceiling-lamp-ql10675-silver`)
- Plafondlamp Zilver QL10674 (`ceiling-lamp-ql10674-silver`)
- Plafondlamp Zilver QL10676 (`ceiling-lamp-ql10676-silver`)
- Wandspiegel Spiegel 170×100×3 Zwart 101 (`mirror-mt-101-black-frame-170x100x3`)
- Plafondlamp Goud QL10602 (`ceiling-lamp-ql10602-sh-2049-900-400-gold`)
- Wandspiegel Spiegel 170×100×3 Wit 104 (`mirror-mt-104-white-frame-170x100x3`)
- Plafondlamp Zilver QL10672 (`ceiling-lamp-ql10672-silver`)
- Plafondlamp Goud 052 (`ceiling-lamp-052-600-s-gold`)
- Wandspiegel 24604ND4-E Spiegel 124×124×4 (`wall-decoration-24604nd4-e-with-led-124x124x4`)
- Plafondlamp Wit GH1012 (`ceiling-lamp-isabel-white-gh1012-1350lx250d`)
- Plafondlamp Bruin GH1013 (`ceiling-lamp-isabel-brown-gh1013-oval-135lx25d`)
- Wandspiegel 24614ND2-E Spiegel 124×124×4 (`wall-decoration-24614nd2-e-with-led-124x124x4`)
- Wandspiegel 25094ND2-E Spiegel 123×123×3 (`wall-decoration-25094nd2-e-with-led-123x123x3`)
- Plafondlamp Goud 036 (`ceiling-lamp-036-600-s-gold`)
- Plafondlamp Ø 45 Zwart GH1103 (`ceiling-lamp-gh1103-45-black`)
- Plafondlamp Ø 60 Goud GH1104 (`ceiling-lamp-gh1104-60-gold`)
- Plafondlamp Ø 45 Goud GH1100 (`ceiling-lamp-gh1100-45-gold`)
- Plafondlamp Ø 45 Zwart GH1106 (`ceiling-lamp-gh1106-45-black`)
- Plafondlamp Ø 45 Goud GH1103 (`ceiling-lamp-gh1103-45-gold`)
- Plafondlamp Zwart GH1108 (`ceiling-lamp-gh1108-900-400-black`)
- Plafondlamp Zilver GH1111 (`ceiling-lamp-gh1111-900-400-silver`)
- Plafondlamp Zilver QL10605 (`ceiling-lamp-ql10605-sh-2040-900-400-silver-ql1502`)
- Plafondlamp Zwart QL10609 (`ceiling-lamp-ql10609-sh-2040-400-black-gold-ql1500`)
- Plafondlamp Zilver QL10603 (`ceiling-lamp-ql10603-sh-2040-400-silver-ql1500`)
- Plafondlamp Wit QL10613 (`ceiling-lamp-ql10613-sh-2040-600-white-gold-ql1501`)
- Plafondlamp Zilver QL10602 (`ceiling-lamp-ql10602-sh-2049-900-400-silver`)
- Plafondlamp Zilver QL10604 (`ceiling-lamp-ql10604-sh-2040-600-silver-ql1501`)
- Plafondlamp Goud QL10606 (`ceiling-lamp-ql10606-sh-2040-400-gold-ql1500`)
- Plafondlamp Goud QL10615 (`ceiling-lamp-ql10615-sh-2058-500-gold-2-doos`)
- Plafondlamp Zilver QL10614 (`ceiling-lamp-ql10614-sh2082-900-400-silver`)
- Plafondlamp Zilver QL10613 (`ceiling-lamp-ql10613-sh-2082-600-silver`)
- Plafondlamp Zilver QL10621 (`ceiling-lamp-ql10621-6030-7-silver`)
- Plafondlamp Goud QL10623 (`ceiling-lamp-ql10623-6030-7-gold`)
- Plafondlamp Zwart QL10619 (`ceiling-lamp-ql10619-0775-3-black`)
- Plafondlamp Zilver QL10638 (`ceiling-lamp-ql10638-3160-600-silver`)
- Plafondlamp Zilver QL10636 (`ceiling-lamp-ql10636-3160-400-silver`)
- Wandspiegel 24603ND2-E Spiegel 123×123×3 (`wall-decoration-24603nd2-e-with-led-123x123x3-7`)
- Plafondlamp Zwart QL10630 (`ceiling-lamp-ql10630-sh-2040-400-black-silver-ql1500`)
- Plafondlamp Goud QL10645 (`ceiling-lamp-ql10645-3161-600-gold-gold`)
- Plafondlamp Goud QL10648 (`ceiling-lamp-ql10648-3162-1200-300-gold`)
- Plafondlamp Zilver QL10647 (`ceiling-lamp-ql10647-3162-600-silver`)
- Plafondlamp Zilver QL10649 (`ceiling-lamp-ql10649-3162-1200-300-silver`)
- Plafondlamp Zilver QL1083 (`ceiling-lamp-ql1083-silver-7331b-7-7-orbits`)
- Plafondlamp Zwart QL10646 (`ceiling-lamp-ql10646-3162-600-black`)
- Plafondlamp Goud QL10647 (`ceiling-lamp-ql10647-3162-600-gold`)
- Plafondlamp Goud QL1085 (`ceiling-lamp-ql1085-gold-7331b-3-2`)
- Plafondlamp Bruin QL1086 (`ceiling-lamp-ql1086-brown-smoke-7331b-3-2-1-orbits`)
- Plafondlamp Zilver QL1086 (`ceiling-lamp-ql1086-silver-7331b-3`)
- Vloerlamp Zwart ART1017 (`floor-lamp-gh-art1017-67012-f-black`)
- Vloerlamp Goud ART1019 (`floor-lamp-gh-art1019-67013-5f-gold`)
- Tafellamp Goud ART1013 (`table-lamp-gh-art1013-gold`)
- Vloerlamp Zwart ART1019 (`floor-lamp-gh-art1019-67013-5f-black`)
- Tafellamp Zwart ART1015 (`table-lamp-gh-art1015-black`)
- Tafellamp Goud ART1016 (`table-lamp-gh-art1016-67012-t-gold`)
- Tafellamp Zwart ART1018 (`table-lamp-gh-art1018-67013-5t-black`)
- Tafellamp Goud ART1018 (`table-lamp-gh-art1018-67013-5t-gold`)
- Tafellamp Zwart ART1016 (`table-lamp-gh-art1016-67012-t-black`)
- Plafondlamp Zilver QL10638 (`ceiling-lamp-ql10638-1-3160-600-silver`)
- Tafellamp Goud ART1014 (`table-lamp-gh-art1014-gold`)
- Plafondlamp Wit QL10614 (`ceiling-lamp-ql10614-sh-2040-900-400-white-gold-ql1502`)
- Plafondlamp Bruin QL1088 (`ceiling-lamp-ql1088-brown-smoke-7331-6-6-rond-orbits`)
- Plafondlamp Wit QL10612 (`ceiling-lamp-ql10612-sh-2040-450-white-gold-ql1500`)
- Plafondlamp Wit GH1013 (`ceiling-lamp-isabel-white-gh1013-oval-1350lx250d`)
- Plafondlamp Zwart QL10625 (`ceiling-lamp-ql10625-6030-7-black`)
- Plafondlamp Zwart 036 (`ceiling-lamp-036-600-black`)
- Dubai ZB-5576 Eetkamerstoel Bruin onderstel Taupe (`chair-dubai-zb-5576-brown-legs-fy2415-6-taupe`)
- Plafondlamp Goud QL10608 (`ceiling-lamp-ql10608-sh-2040-900-400-gold-ql1502`)
- Plafondlamp Zwart 052 (`ceiling-lamp-052-600-black`)
- Plafondlamp Ø 60 Zwart GH1104 (`ceiling-lamp-gh1104-60-black`)
- Plafondlamp Ø 60 Goud GH1110 (`ceiling-lamp-gh1110-60-gold`)
- Plafondlamp Goud QL1084 (`ceiling-lamp-ql1084-gold-7331b-7-7-orbits`)
- Plafondlamp Goud QL10616 (`ceiling-lamp-ql10616-sh-2058-650-gold-2-doos`)
- Plafondlamp Zilver QL10642 (`ceiling-lamp-ql10642-3160-900-400-silver`)
- Plafondlamp Goud QL10641 (`ceiling-lamp-ql10641-3160-900-400-gold`)
- Vloerlamp Goud ART1017 (`floor-lamp-gh-art1017-67012-f-gold`)
- Vloerlamp Goud QL10627 (`floor-lamp-ql10627-sh40-gold`)
- Plafondlamp Goud QL10637 (`ceiling-lamp-ql10637-1-3160-600-gold`)
- Baroni ZB-5686 Eetkamerstoel Grijs (`chair-baroni-zb-5686-grey-fy2415-10`)
- Vloerlamp Goud QL1077 (`floor-lamp-ql1077-6-orbits-gold`)
- Desirey ZB-5685 Eetkamerstoel Bruin onderstel Taupe (`chair-desirey-zb-5685-brown-legs-taupe-fy2415-6`)
- Wandspiegel Spiegel 170×100×3 Wit 102 (`mirror-mt-102-white-frame-170x100x3`)
- Plafondlamp Goud QL10612 (`ceiling-lamp-ql10612-sh-2082-400-gold`)
- Plafondlamp Goud GH1108 (`ceiling-lamp-gh1108-900-400-gold`)
- Desirey ZB-5685 Eetkamerstoel Bruin onderstel Taupe (`chair-desirey-zb-5685-l-brown-legs-taupe-fy2415-6`)
- Plafondlamp Goud GH1102 (`ceiling-lamp-gh1102-900-400-gold`)
- Plafondlamp Ø 60 Zwart GH1107 (`ceiling-lamp-gh1107-60-black`)
- Plafondlamp Zilver QL10620 (`ceiling-lamp-ql10620-6030-3-silver`)
- Plafondlamp Goud QL10637 (`ceiling-lamp-ql10637-3160-600-gold`)
- Plafondlamp Zilver QL10673 (`ceiling-lamp-ql10673-silver`)
- Wandspiegel Spiegel 170×100×3 Zwart 103 (`mirror-mt-103-black-frame-170x100x3`)
- Plafondlamp Ø 60 Goud GH1101 (`ceiling-lamp-gh1101-60-gold`)
- Plafondlamp Ø 45 Goud GH1109 (`ceiling-lamp-gh1109-45-gold`)
- Tafellamp Zwart QL10628 (`table-lamp-ql10628-sh40-black-silver`)
- Plafondlamp Bruin QL1084 (`ceiling-lamp-ql1084-brown-smoke-7331b-6-5-1-orbits`)
- Baroni ZB-5686 Eetkamerstoel Grijs (`chair-baroni-zb-5686-grey`)

### 18× kleur ontbreekt (geen kleur in naam of specs)

- Plafondlamp Ø 50 (`ceiling-lamp-organic-gh1009-50`)
- Tafellamp 32×25 (`table-lamp-travertine-gh-art1026-32x25`)
- Plafondlamp Ø 30 GH1010 (`ceiling-lamp-organic-gh1010-3l-30-x40-x30`)
- Tafellamp 42×25×12 (`table-lamp-travertine-gh-art1025-42x25x12`)
- Plafondlamp GH1016 (`ceiling-lamp-nova-gh1016-3l-80cm`)
- Plafondlamp Ø 30 GH1017 (`ceiling-lamp-nova-gh1017-3r-30`)
- Plafondlamp GH1015 (`ceiling-lamp-travertine-gh1015-4l-100cm`)
- Plafondlamp Ø 30 GH1014 (`ceiling-lamp-travertine-gh1014-3r-30`)
- Tafellamp 45×25×12 (`table-lamp-travertine-gh-art1024-45x25x12`)
- Plafondlamp GH1115 (`ceiling-lamp-gh1115-80-80-39`)
- Plafondlamp QL10617 (`ceiling-lamp-ql10617-6083-d600`)
- Plafondlamp QL1083 (`ceiling-lamp-ql1083-smoke-7331b-6-5-1-orbits`)
- Plafondlamp QL1085 (`ceiling-lamp-ql1085-smoke-7331b-3-2-1-orbits`)
- Plafondlamp QL1087 (`ceiling-lamp-ql1087-smoke-7331-6-6-rond-orbits`)
- Plafondlamp QL10618 (`ceiling-lamp-ql10618-6083-d1000-430`)
- Plafondlamp QL10616 (`ceiling-lamp-ql10616-sh-2058-650-clear-2-doos`)
- Plafondlamp Ø 30 GH1011 (`ceiling-lamp-organic-gh1011-3r-30-x40-x30`)
- Plafondlamp GH1114 (`ceiling-lamp-gh1114-60-60-39`)

### 3× categorie verlichting (Lamp): geen hernoemregel

- Feather Lamp Goud-wit GH1754 (`feather-gh1754-b058-1200-wall-led-lamp-gold-white`)
- Feather Lamp Zwart (`feather-gh1754-b058-1200-wall-led-lamp-black-gold`)
- Feather Lamp Wit GH1754 (`feather-gh1754-b058-1200-wall-led-lamp-white-gold`)

### 2× patroon niet herkend

- Baron stoel  (`baron-zb-5763-como-110-beige`)
- Baronstoel (`baron-zb-5763-como-152-light-brown`)

### 2× maat in naam onleesbaar: …

- Wandspiegel Spiegel 5×90×2 Goud (`mirror-rosa-gold-mt71-157-5x90x2`)
- Wandspiegel Spiegel 5×90×2 Zwart (`mirror-rosa-black-mt72-157-5x90x2`)

### 2× uitvoering … (aantal × maat?) niet eenduidig

- Plafondlamp 3×30 Crème GH1007 (`ceiling-lamp-organic-cream-resin-gh1007-l-3x30`)
- Plafondlamp 3×30 Crème GH1008 (`ceiling-lamp-organic-cream-resin-gh1008-r-3x30`)

### 1× alleen onderstelkleur bekend; stofkleur ontbreekt

- Dubai ZB-5576 Eetkamerstoel Bruin onderstel (`chair-dubai-zb-5576-brown-legs-fy2415-8-brown`)
