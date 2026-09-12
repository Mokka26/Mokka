# Google Shopping & Google Ads — runbook

Status: feed live sinds 2026-09-12. Campagne-opzet in Google Ads is handwerk
(zie stap 3); Windsor.ai kan geen Performance Max-campagnes aanmaken.

## Accounts

| Wat | Naam | ID |
|---|---|---|
| Google Ads | Eleva Home | 607-357-0939 |
| Merchant Center | Mokka Home Interior | 5832975605 |
| Google Ads-tag | — | `AW-18226278121` (env `NEXT_PUBLIC_GOOGLE_ADS_ID`) |
| Purchase-conversielabel | — | env `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` |

## 1. De productfeed

URL: `https://mokkahomeinteriors.nl/feed/google-shopping.xml`

- Bron: `lib/google-shopping.ts` (mapping + item-opbouw) en
  `app/feed/google-shopping.xml/route.ts` (route, elk uur ververst).
- Bevat alle zichtbare, niet-verwijderde producten. Maatvarianten (bedden,
  slaapkamers) staan als aparte items met `item_group_id` = product-id.
- `g:id` = Prisma-id (stabiel, korter dan 50 tekens). Varianten: `<id>-1`, `<id>-2`.
- Prijs: bij korting is `price` de adviesprijs en `sale_price` de verkoopprijs.
- Identificatie: `gtin` uit specs `EAN`, `mpn` uit specs `Artikelnummer`,
  anders `identifier_exists = no`. Merk = `businessInfo.name`.
- Verzending per item uit `lib/shipping-info.ts` (gratis vanaf drempel, anders
  standaardtarief) voor NL en BE. Levertijd-tekst → `min/max_handling_time`.
- Custom labels voor segmentatie in campagnes:
  - `custom_label_0` = leverancier (`source`)
  - `custom_label_1` = prijsbucket (`0-250`, `250-750`, `750-1500`, `1500+`)
  - `custom_label_2` = `featured`
  - `custom_label_3` = `snel-leverbaar` (≤ 10 werkdagen) of `langere-levertijd`
- Google-categorie per webshopcategorie staat in `GOOGLE_PRODUCT_CATEGORY`.
  Nieuwe categorie in `lib/categories.ts`? Voeg hier ook een ID toe
  (taxonomie: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt).

## 2. Merchant Center inrichten (eenmalig, handmatig)

1. Producten → Databronnen → **Primaire databron toevoegen** → "Bestand via
   URL" → geplande ophaalactie, dagelijks, URL hierboven, land NL, taal nl.
2. Voeg dezelfde feed toe met feedlabel/land **BE** als je in België wilt adverteren.
3. Verwijder of pauzeer de oude databron (446 producten, zonder Google-categorie)
   zodra de nieuwe feed is goedgekeurd. Anders krijg je dubbele aanbiedingen.
4. Controleer onder **Producten → Diagnostiek** op afkeuringen. Verwachte
   aandachtspunten: GTIN-mismatches (EAN van leverancier vs. merk "Mokka Home")
   en afbeeldingen met tekst/watermerk.
5. Programma's: zorg dat **Shopping-advertenties** actief is, niet alleen
   gratis vermeldingen. Bevestig verzend- en retourbeleid in de accountinstellingen
   (moet overeenkomen met `/retourneren` en `lib/shipping-info.ts`).
6. Website claimen en verifiëren op `mokkahomeinteriors.nl` (zonder www; de
   feed-links gebruiken die vorm).

## 3. Google Ads-campagnes

Huidige situatie (12 sep 2026, laatste 90 dagen):

| Campagne | Type | Status | Uitgave | Klikken | Conversies |
|---|---|---|---|---|---|
| alles | Search, Maximaliseer klikken | aan | € 255 | 763 | 0 (geen tracking tot vandaag) |
| Campaign #1 | Performance Max | gepauzeerd | € 0 | 0 | 0 |
| Performance Max-2 | Performance Max, gekoppeld aan MC 5832975605 | aan | € 0 | 0 | 0 |

Performance Max-2 levert niets uit omdat de producten in Merchant Center alleen
voor gratis vermeldingen goedgekeurd waren. Na stap 2 begint deze campagne
vanzelf te draaien.

Aanbevolen opzet zodra de feed is goedgekeurd:

1. **Performance Max — Shopping** (bestaande "Performance Max-2" hergebruiken):
   assetgroepen per productgroep op `custom_label_0` of categorie
   (banken, bedden, eettafels + stoelen, verlichting, kasten). Bieden:
   "Maximaliseer conversiewaarde" zonder doel-ROAS tot er ≥ 30 conversies zijn.
2. **Search "alles"**: nu alleen bank-zoekwoorden en één landingspagina
   (`/banken`). Uitbreiden met advertentiegroepen per categorie, elk met een
   eigen landingspagina (`/bedden`, `/eettafels`, `/eetkamerstoelen`, ...).
   Uitsluitingswoorden toevoegen: tuin, loungeset, tweedehands, marktplaats,
   ikea, gratis, hoes, stof, reparatie, huren.
3. Na ≥ 15 conversies per maand: Search overzetten van "Maximaliseer klikken"
   naar "Maximaliseer conversies".

Copyregels (CLAUDE.md §4): geen "premium", "uniek", "de beste"; geen
vergelijking met concurrenten; alleen feitelijke USP's uit `lib/shipping-info.ts`
(gratis verzending vanaf € 100, 14 dagen bedenktijd, iDEAL/Klarna).

## 4. Meten

- Conversies: `PurchaseConversion` op `/checkout/afgerond`, alleen na
  cookie-akkoord (zie `components/GoogleAdsTag.tsx`).
- Rapportage via Windsor.ai (connectors `google_ads` en `google_merchant`).
