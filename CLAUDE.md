# Mokka Home — Claude Code Instructies

Je bouwt mee aan Mokka Home, een Nederlandse meubel- en interieurwebshop. 
Lees deze instructies volledig voor je iets wijzigt of toevoegt. Bij 
conflict tussen mijn vraag en deze regels: wijs me erop en vraag 
bevestiging — voer niet stilzwijgend uit.

## 1. Tech stack
- Next.js (App Router) op Vercel
- TypeScript strict mode
- Tailwind CSS
- Lees package.json voor exacte versies en aanvullende dependencies

## 2. Bronnen van waarheid
Per categorie het ENE bestand waar de canonieke waarde staat. Deze 
waarden mogen NERGENS anders gehardcode worden.

- Bedrijfsgegevens → `lib/business-info.ts`
- Verzend- en retourbeleid → `lib/shipping-info.ts`
- Brand kleuren en typografie → `tailwind.config.ts` + `app/globals.css`
- Brand richtlijnen (tone, copy, beeld) → `docs/brand.md`
- Env vars → `.env.example` (voeg toe als je nieuwe introduceert)

## 3. Doelgroep
Mokka Home bedient klanten van 27 tot 70 jaar. Zwaartepunt 35-55, 
randen secundair (te bevestigen met klant-data).

Implicaties voor design en copy — altijd toepassen:
- Body text minimaal 16px op mobile, 17-18px desktop
- Line-height minimaal 1.6
- Contrast WCAG 2.2 AA minimum (4.5:1 body, 3:1 large text)
- Geen lichtgrijze tekst op witte achtergrond
- Aanspreekvorm: "je" als default
- Geen jargon ("statement piece", "boho-chic", "must-have")
- Maatvoering met praktische context ("past in een eetkamer van 3m breed")
- Telefoonnummer zichtbaar op elke pagina
- Gast-checkout altijd mogelijk
- Geen pop-ups binnen 5 seconden na page load
- Geen autoplay video met geluid
- Geen fake urgency of fake scarcity
- Betaalmethoden breed: iDEAL, creditcard, achteraf betalen, Apple/Google Pay

## 4. Merk & positionering
Status: in ontwikkeling. Canonieke bron is `docs/brand.md`.

Tot positionering definitief vaststaat:
- Geen marketing-claims zonder onderbouwing ("uniek", "premium", "de beste")
- Geen vergelijkingen met concurrenten in copy
- Tone: warm, vakkundig, niet glossy
- Bij twijfel over copy of design: vraag, gok niet

## 5. Werkwijze — verplicht
1. Voor wijzigingen die meer dan 1 bestand raken: eerst plan presenteren, 
   wachten op akkoord, dan pas implementeren
2. Na elke wijziging: `npm run typecheck` + `npm run lint`
3. Bij vage requirements: verduidelijkende vragen stellen
4. Bij architectuur-keuzes: opties tonen met trade-offs
5. Bij design of copy: vraag, gok niet — verwijs naar `docs/brand.md`

## 6. Code conventies
- Server Components by default. `'use client'` alleen bij onClick, 
  useState, useEffect, browser-API's
- TypeScript strict — geen `any`, gebruik `unknown` + type guards
- Named exports, behalve voor pages, layouts, route handlers
- Async/await, geen `.then()` chains
- Early returns boven geneste ifs (max 2 niveaus diep)
- `next/image` voor alle images, `next/link` voor interne navigatie
- Tailwind classes, geen inline styles, geen losse CSS files 
  behalve `globals.css`
- Geen `console.log` in committed code
- Conventional commits (feat:, fix:, chore:, refactor:, docs:, test:)

## 7. Design principes
- Mobile-first, kleinste breakpoint 375px
- Performance budgets: LCP <2.5s, CLS <0.1, INP <200ms
- Toegankelijkheid: WCAG 2.2 AA minimum
- Witruimte boven dichtheid
- Maximaal 2 fonts in design system
- Elke knop heeft duidelijke hover én focus state (geen `outline: none` 
  zonder vervanging)
- Touch targets minimaal 44x44px
- Geen carousels voor primaire content (lage conversie, slecht voor SEO)

## 8. Design tokens
- Alle kleuren uit `tailwind.config.ts` — geen losse hex codes in JSX 
  of CSS
- Semantic naming (`bg-primary`, `text-muted`) boven literal naming 
  (`bg-blue-500`)
- Voeg geen nieuwe kleur toe zonder duidelijke semantische functie
- Legacy tokens (zoals `bronze`) worden actief verwijderd, niet bewaard

## 9. Webshop conventies
- Prijzen altijd met "incl. btw" label
- ProductCard en PDP gebruiken dezelfde prijs-component (`components/ui/price.tsx`)
- Verzendkosten en levertijd zichtbaar VOOR de checkout-stap
- Checkout maximaal 3 stappen
- Gast-checkout altijd mogelijk, geen verplichte account-aanmaak
- Trust signals zichtbaar: reviews, retourbeleid, betaalmethoden, KvK
- Slug structuur: `/categorie/product-naam` (lowercase, hyphens)
- Productpagina toont: meerdere foto's, beschrijving, specs, voorraad, 
  gerelateerde producten, reviews
- Voorraadstatus altijd zichtbaar op ProductCard én PDP

## 10. SEO regels
- Elke route heeft `generateMetadata` met unieke title (50-60 chars) 
  en description (140-160 chars)
- Producten: Product schema JSON-LD
- Categorieën: CollectionPage schema
- Bedrijf: Organization schema in root layout
- `app/sitemap.ts` en `app/robots.ts` actueel houden
- Canonical URLs op elke pagina
- OG images per pagina via `opengraph-image.tsx`
- Heading hierarchie: één H1, geen overgeslagen niveaus
- Alt text op alle images (productnaam, niet "image1.jpg")
- Geen client-side rendering voor SEO-kritieke content

## 11. Marketing & conversie
- Eén primaire CTA per pagina, secundaire CTAs ondergeschikt
- Boven de fold: value prop + trust signal + CTA
- Email capture: niet als instant pop-up, wel als exit intent of na 
  50% scroll
- Social proof tonen waar relevant (reviews bij producten, klantenlogo's 
  bij merken)
- Urgency en scarcity ALLEEN als ze feitelijk waar zijn
- Cookie banner: alleen wettelijk verplicht, geen dark patterns, geen 
  "Accepteer alles" prominenter dan "Weigeren"

## 12. Quality gates voor deploy
Voor elke productie-deploy moet draaien:
1. `npm run build` — slaagt zonder warnings
2. `npm run lint` — clean
3. `npm run typecheck` — clean
4. `/security-review` op gewijzigde files
5. `/seo-check` op nieuwe of gewijzigde routes
6. `/a11y-check` op nieuwe of gewijzigde componenten
7. Lighthouse mobile >90 op Performance, Accessibility, Best Practices, SEO

## 13. Wat NIET te doen
- Geen nieuwe dependencies zonder vragen
- Geen wijzigingen aan `next.config.ts`, `tailwind.config.ts`, 
  `tsconfig.json` zonder uitleg
- Geen inline styles
- Geen `<a>` voor interne navigatie
- Geen `any` types
- Geen producten, prijzen, of bedrijfsgegevens hardcoden in componenten
- Geen client components voor data fetching
- Geen fake reviews of testimonials
- Geen `.env` bestanden lezen of inhoud tonen
- Geen Google Fonts vanaf googleapis.com — zelf-hosten via `next/font/google`

## 14. Bedrijfsgegevens
Status: in afwachting van klant-bevestiging. Tot bevestigd:
- Gebruik placeholders met TODO comments in `lib/business-info.ts`
- Geen verzonnen waarden in productie code
- Footer en schema gebruiken altijd de waarden uit `lib/business-info.ts`