# Meten & conversies — GA4, Google Ads, Consent Mode

Status: code gereed op 2026-10-12. Werkt pas als de env-variabelen (§1) op
Vercel staan en de stappen in Google Ads/GA4 (§5) zijn gedaan. Rapportage
(Windsor.ai) staat in `docs/google-shopping.md` §4.

## 1. Env-variabelen

| Variabele | Waar | Wat |
|---|---|---|
| `NEXT_PUBLIC_GA4_ID` | Vercel (alle omgevingen waar je wilt meten) | GA4 Measurement-ID, vorm `G-XXXXXXXXXX` (GA4 → Beheer → Gegevensstreams → webstream) |
| `GA4_API_SECRET` | Vercel, **alleen server** | Measurement Protocol API-secret (zelfde webstream → "API-geheimen voor Measurement Protocol" → Maken) |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Vercel | Google Ads-tag `AW-18226278121` |
| `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` | Vercel | Conversielabel van de purchase-conversieactie (Ads → Doelen → Conversies → actie → "Tag instellen" → het deel na `AW-…/`) |

- Zonder `NEXT_PUBLIC_GA4_ID` én zonder `NEXT_PUBLIC_GOOGLE_ADS_ID` laadt er
  helemaal geen Google-script (lokaal/preview blijft schoon).
- Zonder `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` vuurt alleen het GA4
  `purchase`-event, géén Ads-conversie (wel loggen we niets; zet de label).
- Zonder `GA4_API_SECRET` is de server-side purchase een no-op.

## 2. Wat er in de code zit

| Bestand | Rol |
|---|---|
| `components/Analytics.tsx` | Google-tag (gtag.js) voor GA4 + Ads. Inline Consent Mode v2-default (`denied`, `wait_for_update: 500`), direct `granted` bij eerder akkoord; `allow_enhanced_conversions` op de Ads-config. Gerenderd in `app/layout.tsx`. |
| `lib/analytics.ts` | Client-helpers: `applyConsent`, `trackViewItem`, `trackAddToCart`, `trackViewCart`, `trackBeginCheckout`, `trackAddShippingInfo`, `trackAddPaymentInfo`, `setUserData`, `trackPurchase`. No-op zonder gtag, gooien nooit. |
| `components/CookieBanner.tsx` | Roept `applyConsent(keuze)` aan → `gtag('consent','update', …)`. |
| `app/products/[slug]/ProductDetailClient.tsx` | `view_item` bij mount, `add_to_cart` in de koopknop (regelprijs incl. maat/opties, `item_variant`). |
| `components/CartDrawer.tsx` | `view_cart` bij openen, `begin_checkout` op "Afrekenen". |
| `app/checkout/page.tsx` | `begin_checkout` zodra de wagen geladen is; `add_shipping_info` (`shipping_tier` gratis/standaard) + `add_payment_info` (`payment_type` = Mollie-methode) bij een geldige submit. |
| `app/checkout/afgerond/page.tsx` + `PurchaseConversion.tsx` | Bij status `paid` en vertrouwde token: Enhanced Conversions `user_data` (alleen bij akkoord), dan GA4 `purchase` + Ads `conversion`. Eén keer per bestelnummer (localStorage). |
| `lib/analytics-server.ts` + `lib/order-sync.ts` | Server-side purchase via Measurement Protocol, in het codepad dat de order naar `paid` claimt (zelfde moment als de bevestigingsmail), via `after()` na de response. |

### Consent Mode v2 ("advanced")

- De tag laadt altijd; zonder akkoord staan `ad_storage`, `ad_user_data`,
  `ad_personalization` en `analytics_storage` op `denied`. Google zet dan geen
  cookies en stuurt alleen cookieloze pings; Ads/GA4 modelleren conversies.
- "Accepteren" → alles `granted`; "Weigeren" → blijft `denied`. De keuze staat
  in localStorage (`mokka_cookie_consent_v1`); bij terugkerend bezoek zet het
  inline script de status al vóór gtag.js laadt.
- Let op voor het cookiebeleid: het script zélf laadt dus ook zonder akkoord
  (zonder cookies). Als de cookiepagina belooft dat er zonder akkoord *geen*
  Google-script draait, moet die tekst daarop aangepast worden, of zet de
  component terug op "basic" (alleen renderen na akkoord).

### Paginaweergaven in GA4

Next.js navigeert via `history.pushState`. Zet in GA4 → Gegevensstream →
Verbeterde meting → "Paginaweergaven" → *Paginawijzigingen op basis van
browsergeschiedenis-gebeurtenissen* **aan** (standaard aan). Dan telt elke
client-side navigatie als page_view; wij sturen er bewust geen extra.

### Waarden

- GA4 `purchase.value` = som van regelprijzen × aantal (incl. btw, zonder
  verzending; GA4-conventie), `shipping` = verzendkosten, `tax` = 21/121 van
  het ordertotaal (er is geen btw-uitsplitsing op de Order).
- Ads `conversion.value` = ordertotaal incl. verzending (wat Mollie int),
  `transaction_id` = bestelnummer, `new_customer` = eerste betaalde order op
  dat e-mailadres.
- `item_id` = Prisma-product-id = `g:id` in de Shopping-feed, dus Ads/GA4
  kunnen items aan de feed koppelen. Maatvarianten staan in de feed als
  `<id>-n`; in de events als `item_variant` op het hoofd-id.

### Server-side purchase — beperking

GA4 ontdubbelt `purchase` op `transaction_id` alleen binnen dezelfde
`client_id`. De browser-purchase komt van het echte `_ga`-cookie; de Order
bewaart dat id niet (geen `gaClientId`-veld). De server stuurt daarom een
deterministisch id uit `publicToken` en het event heet **`server_purchase`**
(zelfde parameters), zodat GA4-omzet niet dubbel telt. Gebruik:

- audit: `server_purchase` ≈ betaalde orders in de admin; het verschil met
  `purchase` = wat de browser mist (adblockers, niet-geladen bedankpagina).
- wil je het als echte `purchase` met ontdubbeling: voeg `gaClientId` toe aan
  `Order` (checkout leest `_ga`-cookie → `GA1.1.<a>.<b>` → `<a>.<b>`), geef het
  mee aan `queueServerPurchase` en `buildPurchasePayload` schakelt vanzelf naar
  `purchase`.

Testen zonder live data: zelfde payload naar
`https://www.google-analytics.com/debug/mp/collect?…` geeft validatiefouten
terug (het echte endpoint antwoordt altijd 2xx).

## 3. gclid en offline conversies

De checkout slaat `gclid` op de Order op (`?gclid=` of de `_gcl_aw`-cookie).
Daarmee kun je betaalde orders die de browser niet meldde alsnog aan Google Ads
geven:

1. **Google Ads → Doelen → Conversies → Uploads** (of "Importeren" → "Andere
   gegevensbronnen of CRM's" → "Uploaden"). Formaat: CSV/Sheets-sjabloon
   "Conversies van klikken" met kolommen `Google Click ID`, `Conversion Name`
   (naam van de purchase-actie), `Conversion Time` (`yyyy-MM-dd HH:mm:ss`,
   tijdzone volgens sjabloon-header), `Conversion Value`, `Conversion Currency`
   (`EUR`), optioneel `Order ID` (= bestelnummer, ontdubbelt met de web-tag).
2. Exporteer uit de database: orders met `status = 'paid'` en `gclid IS NOT NULL`,
   kolommen `gclid, paidAt, total, orderNumber`. Upload uiterlijk 90 dagen na de
   klik, minimaal enkele uren na de klik.
3. Alternatief: GA4-conversies importeren in Ads (§5 stap 5) — dan telt ook
   `server_purchase` mee als je die als conversiegebeurtenis markeert (zet hem
   dan op *secundair*, anders dubbel met de tag-conversie).

## 4. Enhanced Conversions (web)

- Vóór het conversie-event zet `PurchaseConversion` `gtag('set','user_data',
  { email, phone_number (E.164), address: { first_name, last_name, street,
  city, postal_code, country } })` — gtag hasht dit in de browser (SHA-256);
  wij loggen niets. Alleen bij cookie-akkoord (`ad_user_data: granted`).
- Google Ads → Doelen → Conversies → Instellingen → **Verbeterde conversies**
  → aanzetten → "Google-tag" → "Automatisch" of "Handmatige configuratie"
  (wij gebruiken `user_data` via gtag, dus "Google-tag" volstaat). Na 48 uur
  staat de status bij de conversieactie op "Opgenomen".

## 5. Stappen in Google Ads en GA4 (eenmalig, handmatig)

1. **GA4-property** aanmaken (of bestaande gebruiken) → webstream voor
   `mokkahomeinteriors.nl` → `G-…` in `NEXT_PUBLIC_GA4_ID`; API-secret in
   `GA4_API_SECRET`. Verbeterde meting: paginawijzigingen aan (zie §2).
2. **Purchase-conversieactie in Ads**: Doelen → Conversies → Nieuwe
   conversieactie → Website → handmatig → categorie "Aankoop", waarde = "andere
   waarde per conversie" (uit de tag), telling "Elke", attributie
   "Datagestuurd". Label → `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`. Markeer als
   **primair**; alle andere acties secundair.
3. **Consent Mode controleren**: Ads → Doelen → Conversies → Diagnose (of
   Beheer → Google-tag → Diagnose): "Toestemmingsinstellingen" moet "Actief"
   melden met `ad_storage`/`ad_user_data` gezien. Test lokaal met de Chrome-
   extensie "Tag Assistant": default denied → update granted na "Accepteren".
4. **Verbeterde conversies** aan (zie §4).
5. **GA4 koppelen**: GA4 → Beheer → Productkoppelingen → Google Ads → koppel
   607-357-0939 (gepersonaliseerde advertenties aan). In Ads → Doelen →
   Conversies → Importeren → GA4 → `purchase` (zet op **secundair**: de
   tag-conversie uit stap 2 is primair; anders dubbel) en eventueel
   `server_purchase` (secundair, als audit).
6. **Testen**: bestel met een Mollie-testbetaling → GA4 DebugView (Chrome
   "GA Debugger" of `?gtm_debug=x`) toont `view_item` → `add_to_cart` →
   `begin_checkout` → `add_shipping_info`/`add_payment_info` → `purchase`;
   Ads → Conversies → kolom "Recente conversies" na 3–6 uur.
7. **Windsor.ai**: connector `googleanalytics4` koppelen voor rapportage
   (naast `google_ads` en `google_merchant`, zie `docs/google-shopping.md`).

## 6. CSP (next.config.js)

Voor GA4 moeten deze hosts in de Content-Security-Policy staan (naast de
bestaande Ads-hosts):

- `script-src`: `https://www.googletagmanager.com` (staat er al)
- `connect-src`: `https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com`
- `img-src`: `https://*.google-analytics.com https://*.googletagmanager.com`
