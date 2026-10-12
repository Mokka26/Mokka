# Testen

Unit- en integratietests draaien met **Jest 29** via `next/jest` (SWC-transform,
`@/`-alias uit `tsconfig.json`). Configuratie: `jest.config.mjs` en
`jest.setup.ts`. Tests staan in `__tests__/`, gespiegeld aan de bronboom:

```
__tests__/
  helpers/     fixtures (makeProduct, makeOrder, …) en de getypte Prisma-mock
  lib/         één bestand per module in lib/
  app/         server actions en route handlers (checkout, Mollie-webhook)
```

## Draaien

| Commando            | Doel                                                        |
| ------------------- | ----------------------------------------------------------- |
| `npm test`          | alle tests                                                  |
| `npm run test:watch`| watch-modus tijdens ontwikkelen                             |
| `npm run test:ci`   | `jest --ci --coverage --maxWorkers=2` (wat de CI draait)    |
| `npx jest lib/specs`| alleen bestanden waarvan het pad matcht                     |

Coverage komt in `coverage/` (genegeerd door git). Voor `lib/` geldt een
ondergrens van **70 % lines** (`coverageThreshold` in `jest.config.mjs`);
daaronder faalt `test:ci`. `app/`-code heeft geen drempel: routes en
server actions worden gericht getest, niet op percentage.

Alle tests draaien in Node (`testEnvironment: "node"`). Een component-test
die een DOM nodig heeft zet bovenaan het bestand:

```ts
/** @jest-environment jsdom */
```

`@testing-library/jest-dom` is dan al geladen via `jest.setup.ts`.

## Regels

1. **Nooit de echte database, Mollie of SMTP raken.** `jest.setup.ts` wist
   `DATABASE_URL`, `MOLLIE_API_KEY` en de SMTP-variabelen, zodat een vergeten
   mock hard faalt. Mock altijd:
   - `@/lib/prisma` → `createPrismaMock()` uit `__tests__/helpers/prisma-mock.ts`
   - `@/lib/mollie` → `getMollie: jest.fn()` (eventueel met `jest.requireActual`
     voor de pure helpers zoals `toMollieAmountCents`)
   - `@/lib/email`, `@/lib/sentry`, `@/lib/analytics-server`
   - `next/cache` (`revalidatePath`, `revalidateTag`, `unstable_cache`) en
     `next/headers` (`headers`, `cookies`) waar de module ze importeert
2. **Getypte mocks, geen `any`.** Gebruik `jest.mocked(fn)` voor geïmporteerde
   functies en `asPrismaMock(prisma)` voor de Prisma-client. Waar een
   Next-type niet te construeren is (bv. `ReadonlyHeaders`), cast via
   `as unknown as Awaited<ReturnType<typeof headers>>`.
3. **Fixtures via fabrieken.** `makeProduct()`, `makeOrder()`,
   `makeOrderItem()`, `makeCustomer()` en `sizeVariantsJson()` geven een
   compleet, geldig object; overschrijf alleen wat de test nodig heeft.
4. **Bedrijfs- en verzendgegevens niet hardcoden** in verwachtingen: lees ze
   uit `lib/business-info.ts` en `lib/shipping-info.ts` (CLAUDE.md §2), dan
   blijven de tests kloppen als de klant waarden bevestigt.
5. **Gevonden bugs documenteren, niet verbergen.** Een test die een bekende
   bug beschrijft staat als `it.failing(...)` met een BUG-commentaar. Zo'n
   test slaagt zolang de bug bestaat en gaat falen zodra hij gefixt is —
   verwijder dan `.failing`.

### Voorbeeld: module met Prisma mocken

```ts
import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { prisma } from "@/lib/prisma";
import { findRedirectTarget } from "@/lib/slug-redirect";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));

const db = asPrismaMock(prisma);

it("…", async () => {
  db.slugRedirect.findUnique.mockResolvedValue({ productId: "p1" });
  db.product.findFirst.mockResolvedValue({ slug: "nieuw", category: "eettafels" });
  expect(await findRedirectTarget("oud")).toEqual({ slug: "nieuw", category: "eettafels", url: "/eettafels/nieuw" });
});
```

`jest.mock` wordt door de SWC-transform gehoist; de factory mag daarom alleen
`jest.*` en `jest.requireActual` gebruiken, geen variabelen uit het bestand.

Voor `prisma.$transaction(async (tx) => …)` is er `createTxMock()` +
`useTransaction(db, tx)`; `tx.order.updateMany` / `tx.product.updateMany` zijn
dan losse mocks (zie `__tests__/lib/order-sync.test.ts`).

## Wat gedekt is

| Module                          | Gedekt gedrag                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `lib/money.ts`                  | centen-rekenen, btw-uitsplitsing, Mollie-notatie, NL-weergave                                     |
| `lib/parse-price.ts`            | alle admin-invoernotaties, fouten, leeg vs. verplicht                                              |
| `lib/specs.ts`                  | afmetingen parsen/formatteren (alle notaties), spec-sleutels normaliseren, maatcontext, materiaal, productcodes, slugs, kleuren |
| `lib/categories.ts`             | route-slugs, product-URL's, aanvullende categorieën                                               |
| `lib/orders.ts`                 | `computeOrder` (voorraad, varianten, opties, verzending, centen tellen exact op), ordernummer, token |
| `lib/order-sync.ts`             | idempotente betaalsync (claim/geen claim, geen downgrade, authorized, mailfout, overselling), bedankpagina, reconcile-cron, mail opnieuw |
| `lib/rate-limit.ts`             | onder/boven limiet, fail-open/fail-closed, IP-herleiding, anonieme bucket                          |
| `lib/slug-redirect.ts`          | redirect naar zichtbaar product, verborgen/zelfverwijzend/onbekende categorie → null              |
| `lib/revalidate.ts`             | alle paden incl. umbrella's, vorige slug/categorie, tag                                            |
| `lib/google-shopping.ts`        | feed-items: filters, titel, identificatie, varianten, verzending per land, custom labels          |
| `lib/jsonLd.ts`                 | Product/AggregateOffer, gtin13, titel ≤ 60, description 140-160, Organization, Breadcrumb, FAQ    |
| `lib/cloudinary-url.ts` e.a.    | URL-transformaties, next/image-loader, publicId; `imageHelpers`, `safePath`, `cron-auth`, `shipping-info`, `business-info` |
| `app/checkout/actions.ts`       | zod-validatie (postcodes NL/BE), rate-limit, PRICE_CHANGED, orderaanmaak, Mollie-payload (incl. Klarna-regels), generieke foutmeldingen |
| `app/api/webhooks/mollie`       | 400 bij ongeldig id/body, 200 bij onbekend, 500 bij fout                                          |

Niet gedekt (bewust): `lib/email.ts` (nodemailer-templates), `lib/analytics.ts`
(browser-gtag), `lib/prisma.ts` (retry-extensie), `lib/sentry.ts`,
`lib/product-counts.ts` en de React-componenten.

## CI

`.github/workflows/ci.yml` draait op elke push en pull request (Node 22):
`npm ci` → `npx prisma generate` (met dummy `DATABASE_URL`, zonder database)
→ `npm run typecheck` → `npm run lint` → `npm run test:ci`. Geen deploy en
geen secrets; Vercel bouwt en deployt zelf. Het lcov-rapport wordt als
artifact bewaard.

Lokaal vóór een commit: `npm run typecheck && npm run lint && npm test`
(CLAUDE.md §5 en §12).

## Volgende stappen

1. **Playwright e2e voor de checkout** (`playwright` staat al in de
   devDependencies): winkelwagen → checkout → Mollie **test-mode** (`test_…`
   API-key) → betaling kiezen op de Mollie-testpagina (status `paid`,
   `failed`, `expired`) → bedankpagina toont de juiste status → webhook
   boekt voorraad af. Draai tegen een aparte test-database (bv. Neon-branch)
   en `NEXT_PUBLIC_BASE_URL` van een preview-deploy, zodat Mollie de webhook
   kan bereiken.
2. **Component-tests (jsdom)** voor `ProductCard`, `Price`, `CartDrawer` en
   de checkout-formuliervalidatie (`@testing-library/react` staat klaar).
3. **E-mailtemplates** snapshot-testen met een gemockte `nodemailer`-transport
   (`lib/email.ts`), zodat bedrijfsgegevens en bedragen in de mail kloppen.
4. **Contract-test voor de Shopping-feed**: het volledige RSS-document
   valideren tegen de Merchant Center-specificatie (verplichte attributen per
   item) met een vaste set fixtures.
5. De `it.failing`-tests omzetten zodra de bijbehorende bugs gefixt zijn
   (zoek op `BUG (gevonden tijdens het testen` in `__tests__/`).
