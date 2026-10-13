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
  `app/feed/google-shopping.xml/route.ts` (route, `revalidate = 3600`,
  `Content-Type: application/xml; charset=utf-8`, `Content-Length` en
  `X-Feed-Items` als headers). Feedregels herzien op 2026-10-12.
- Omvang (2026-10-12): 1.151 producten → 1.397 items, 2,75 MB.

### Welke producten

- Alleen `hidden = false`, `deletedAt = null`, `stock > 0` en `price > 0`.
  Uitverkochte producten staan **niet** in de feed (geen `out_of_stock`-items);
  verborgen producten ook niet. Maatvarianten met prijs 0 worden overgeslagen.
- Maatvarianten (bedden, slaapkamers) zijn aparte items met `item_group_id` =
  product-id, `g:size` = label en een eigen link `…?maat=<label>` zodat de PDP
  de juiste maat en prijs toont (de PDP moet `?maat=` lezen — bij de PDP-engineer).
- `g:id` = Prisma-id (stabiel, korter dan 50 tekens). Varianten: `<id>-1`, `<id>-2`.

### Titel, beschrijving, attributen

- `g:title` = `<producttype> <naam zonder leverancierscode> – <serie/model> – <materiaal> – <kleur> – <afmeting>`,
  zonder herhalingen, afgekapt op 150 tekens (op een scheidingsteken). Het
  producttype (enkelvoud, uit `lib/specs.ts`) wordt alleen toegevoegd als de
  naam het nog niet bevat ("Nora Eettafel" blijft "Nora Eettafel"). Blijft er
  na het weghalen van de code niets onderscheidends over (geen serie, materiaal
  of afmeting), dan gaat `specs.Artikelnummer` mee ("Plafondlamp Zilver – QL10675"),
  zodat titels in de feed uniek blijven.
- `g:description` = beschrijving zonder HTML, max. 5000 tekens. Zonder
  beschrijving een feitelijke regel: naam, categorie, afmetingen, materiaal.
- `g:product_type` = `Meubels > <groep> > <categorielabel>`; de groep is
  `feedGroup` uit `lib/categories.ts` als die afwijkt van de navigatiegroep
  (tv-meubels → Opbergen, poefs → Zitten).
- `g:product_width/length/height` in cm uit `specs.Afmetingen`
  (`parseDimensions`); rond → breedte = lengte = Ø. Bij een maatvariant uit het label.
- `g:color` = `colorName` of `specs.Kleur`; `g:material` = `specs.Materiaal`.

### Prijs (Omnibus)

- `g:price` = verkoopprijs. **Geen** `sale_price`.
- `USE_LIST_PRICE_AS_REFERENCE` (constante in `lib/google-shopping.ts`) staat op
  `false`. Op `true` wordt `price` = adviesprijs (`listPrice`) en `sale_price` =
  verkoopprijs, maar alleen als `listPrice > price`. Dat staat uit omdat een
  doorgestreepte "van"-prijs onder de Omnibus-richtlijn (art. 6:193g BW / Besluit
  prijsaanduiding) de laagste prijs van de voorgaande 30 dagen moet zijn; de
  leveranciers-adviesprijzen in `listPrice` zijn dat niet aantoonbaar. Pas
  inschakelen als er een prijshistorie is die dat onderbouwt (ook voor de PDP).

### Identificatie (merk, GTIN, MPN)

`g:brand` is verplicht in Merchant Center en gaat altijd mee: `specs.Merk`
(de fabrikant), anders de winkelnaam.

| Situatie | brand | gtin | mpn | identifier_exists |
|---|---|---|---|---|
| EAN aanwezig, `specs.Merk` aanwezig | Merk | EAN | Artikelnummer | (standaard: ja) |
| EAN aanwezig, geen Merk | `Mokka Home` | EAN | Artikelnummer | (standaard: ja) |
| geen EAN | `specs.Merk` of `Mokka Home` | — | — | `no` |

Zonder EAN wordt geen `mpn` gestuurd: brand + mpn geldt als identificatie en
spreekt `identifier_exists = no` tegen. Geeft Merchant Center "GTIN-mismatch"
of een merk-waarschuwing op items met EAN en de winkelnaam als brand, vul dan
per leverancier `specs.Merk` (de echte fabrikant — nooit `source`, dat is
intern). Op 2026-10-12: 367 items met GTIN, 1.030 met `identifier_exists = no`.

### Verzending en levertijd

- Per item een `g:shipping`-blok per land uit `shippingInfo.freeShippingCountries`
  (NL en BE) met de werkelijke kosten voor dát item: 0 vanaf de gratis-drempel,
  anders `rates.standard`. Twee tarieven per land in één item is niet mogelijk.
- `g:min_handling_time` / `g:max_handling_time` uit de levertijd-tekst
  (werkdagen; "x weken" × 5). `g:transit_time_label` = `snel-leverbaar`
  (≤ 5 werkdagen) of `langere-levertijd`; dat label moet in Merchant Center →
  Verzending aan een transit-tijd gekoppeld worden, anders wordt het genegeerd.
- Geen `availability_date`.

#### transit_time_label koppelen (eenmalig, handmatig in Merchant Center)

1. Merchant Center → Instellingen → **Verzending en retouren** → verzendservice
   voor Nederland (en België) openen of aanmaken.
2. Bij **Bezorgtijd** kies je "Transittijd per label" (transit time labels) en
   voeg je twee labels toe, exact zoals in de feed: `snel-leverbaar` → 1-3
   werkdagen, `langere-levertijd` → 10-40 werkdagen (bestelwerk 2-4 weken,
   maatwerk 6-8 weken; zie `lib/shipping-info.ts`).
3. Handling time niet in de service invullen: die komt per item uit
   `g:min_handling_time`/`g:max_handling_time`.
4. Na de volgende feed-ophaalactie: Producten → Diagnostiek controleren op
   "ongeldig transit_time_label" (label niet gekoppeld) en op de getoonde
   bezorgdatum bij een snel- en een langzaam-leverbaar item.

### Custom labels (campagne-segmentatie)

| Label | Waarde | Gebruik |
|---|---|---|
| `custom_label_0` | `favoriet` (featured) / `regulier` | **Basis voor "alleen favorieten adverteren"** (zie §3) |
| `custom_label_1` | prijsbucket `0-250`, `250-500`, `500-1000`, `1000-2000`, `2000+` | biedstrategie per prijsklasse |
| `custom_label_2` | categorie-slug (`eettafels`, `bedden`, …) | assetgroepen per categorie |
| `custom_label_3` | `snel-leverbaar` (≤ 5 werkdagen) / `langere-levertijd` | snelle levering uitlichten |
| `custom_label_4` | `nieuw` (aangemaakt < 30 dagen), anders leeg | nieuwe collectie |

De leverancier (`source`) staat **nooit** in de feed.

### Google-productcategorieën

`GOOGLE_PRODUCT_CATEGORY` in `lib/google-shopping.ts`; alle ID's zijn op
2026-10-12 (tweemaal) geverifieerd tegen de Nederlandse taxonomie
(https://www.google.com/basepages/producttype/taxonomy-with-ids.nl-NL.txt).
Correcties: `kasten` (umbrella) → 6356 "Meubelen > Kasten en opbergmeubelen"
(was 436 "Meubelen"); `stoelen` (umbrella) → 443 "Meubelen > Stoelen" (was
5886, alleen eetkamerstoelen). Let op de vertaling: Google's "Dressoirs"
(4195) is het Amerikaanse "Dressers" = ladekasten/commodes, dus `ladekasten`
→ 4195; een Nederlands dressoir is "Glazenkasten en buffetten" (447, "Buffets &
Sideboards"), dus `dressoirs` → 447. Beide bevestigd. Nieuwe categorie in
`lib/categories.ts`? Voeg hier ook een ID toe.

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

0. **Alleen favorieten adverteren, de rest pauzeren** (wens eigenaar):
   in Google Ads → campagne "Performance Max-2" → Vermeldingsgroepen
   (listing groups) → onderverdelen op *Aangepast label 0* → `favoriet`
   = opgenomen, `regulier` = **uitgesloten**. Welke producten "favoriet" zijn
   regel je in de admin met het sterretje (`featured`); binnen een uur staat
   het in de feed en na de volgende Merchant Center-ophaalactie in Ads.
   Op 2026-10-12: 352 items favoriet, 1.045 regulier. Dezelfde filter bij een
   Standaard Shopping-campagne: productgroepen op `custom_label_0`.
1. **Performance Max — Shopping** (bestaande "Performance Max-2" hergebruiken):
   assetgroepen per productgroep op `custom_label_2` (categorie-slug)
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

## 5. Aangemaakt op 2026-09-12 (via Windsor.ai)

Campagne "alles" (24094411861):

- 15 uitsluitingswoorden op campagneniveau (tuin, loungeset, tweedehands,
  marktplaats, ikea, gratis, hoes, stof, reparatie, huren, occasion, outlet,
  vacature, "bankstel stofferen", "bank reinigen").
- Vijf advertentiegroepen, elk 9 phrase-zoekwoorden + 1 responsive search ad
  (11 koppen, 4 beschrijvingen), **gepauzeerd** aangemaakt:

| Groep | Ad group id | Landingspagina |
|---|---|---|
| Bedden | 203985992070 | /bedden |
| Eettafels | 203022162471 | /eettafels |
| Eetkamerstoelen | 208574524788 | /eetkamerstoelen |
| Verlichting | 203214282914 | /verlichting |
| Kasten | 203179279627 | /kasten |

Nog open: biedplafond "Maximaliseer klikken" staat op € 0,20 (te laag, campagne
"Beperkt door biedstrategie"). Handmatig verhogen naar € 1,00 in Google Ads.


## 6. Status 2026-10-12: campagnes gepauzeerd, favorieten-campagne volgt na deploy

Beide lopende campagnes zijn op 2026-10-12 via Windsor.ai gepauzeerd (omkeerbaar met de actie enable_campaign):

| Campagne | Id | Type | 90 dagen t/m 12 okt |
|---|---|---|---|
| alles | 24094411861 | Search | EUR 257, 772 klikken, 0 gemeten conversies |
| Performance Max-2 | 24244952117 | Performance Max (alle producten) | EUR 1.114, 1.983 klikken, 0 gemeten conversies |

Reden: de eigenaar wil alleen favorieten (featured) adverteren en de rest pauzeren, en de conversiemeting was tot nu blind (alleen een purchase-event op de bedankpagina; zie docs/tracking.md).

**Vervolgstappen (na push + deploy van deze code en het zetten van de env-variabelen uit docs/tracking.md):**
1. Merchant Center: feed-URL opnieuw laten ophalen; controleren dat custom_label_0 de waarden favoriet/regulier heeft en dat er geen afkeuringen zijn (GTIN/merk, prijs-mismatch).
2. Google Ads (browser): nieuwe Shopping-campagne (standaard, niet PMax) met EEN productgroep gefilterd op custom_label_0 = favoriet; alles overig uitsluiten. Budget en biedstrategie volgens hoofdstuk 3 (start Maximaliseer klikken met plafond, tROAS na 30+ conversies).
3. Conversies: purchase als primaire conversie, Enhanced Conversions aan, Consent Mode-status controleren, GA4 koppelen (docs/tracking.md).
4. Pas daarna eventueel de Search-campagne per categorie opnieuw inschakelen (alleen voor categorieen met favorieten).
