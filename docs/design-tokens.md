# Design tokens — Mokka Home

Stand: november 2026. **Bron van waarheid is `app/globals.css`** (Tailwind v4:
tokens in het `@theme`-blok, componentstijlen als `@utility`). Er is géén
`tailwind.config.ts`; waar CLAUDE.md daarnaar verwijst, is `@theme` in
`app/globals.css` bedoeld. Wijzig een token daar en werk dit document bij.

Contrastwaarden zijn gemeten op `paper` (#F4F0E8), tenzij anders vermeld.

## 1. Kleuren

Gebruik altijd de semantische naam (`text-ink`, `bg-paper`, `border-line`),
nooit een losse hexcode in JSX of CSS. Uitzondering: e-mailtemplates
(`lib/email.ts`) gebruiken inline hexwaarden omdat mailclients geen CSS-variabelen
kennen; die waarden zijn gelijk aan de tokens hieronder.

### Tekst (donker)

| Token | Hex | Gebruik | Contrast |
|---|---|---|---|
| `ink` | #14110D | Koppen, primaire knoppen, focusring | ruim AAA |
| `graphite` | #3D3D3D | Standaard bodytekst (`body`), logo-kleur | AAA |
| `slate` | #5A5854 | Secundaire bodytekst, intro's | AA |
| `stone` | #6B675F | Labels, meta, eyebrows, placeholders | 4,96:1 (AA) |

### Vlakken en lijnen (licht)

| Token | Hex | Gebruik |
|---|---|---|
| `paper` | #F4F0E8 | Primaire achtergrond (warm wit) |
| `white` | #FBF9F4 | Kaarten, lichte blokken |
| `bone` | #EEEAE3 | Foto-placeholders, subtiele achtergrond |
| `line` | #E5E1D9 | Decoratieve randen en dividers (1,15:1 — **niet** voor veldranden) |
| `mist` | #D6D2CB | Sterkere decoratieve randen |
| `line-strong` | #8A857D | Veldranden en UI-randen, 3,2:1 (WCAG 1.4.11) |

### Accent (terracotta)

| Token | Hex | Gebruik | Contrast |
|---|---|---|---|
| `accent` | #B96B4C | Decoratief: lijnen, iconen, koppen vanaf 24px | 3,5:1 — niet voor kleine tekst |
| `accent-dark` | #9A5639 | Accenttekst, links, hover van knoppen | 4,9:1 (AA) |
| `accent-light` | #C9876C | Accent op donkere (ink) achtergrond | — |

### Feedback

| Token | Hex | Gebruik | Contrast |
|---|---|---|---|
| `success` | #3D6B4A | Bevestigingen, op voorraad | 6,6:1 |
| `warning` | #8C5A14 | Let-op-meldingen | 5,2:1 |
| `error` | #8B3A3A | Foutmeldingen, `btn-destructive` | 7,6:1 |
| `error-light` | #D98C8C | Foutmelding op ink-achtergrond | 7,4:1 op ink |

### Legacy

- `bronze` bestaat niet meer en mag niet terugkomen.

## 2. Typografie

Twee lettertypen, zelf gehost via `next/font/google` (`app/layout.tsx`):

| Token | Font | Functie |
|---|---|---|
| `--font-sans` (`font-sans`) | Geist (variabel) | Lopende tekst, navigatie, knoppen, labels, formulieren |
| `--font-serif` (`font-serif`) | Source Serif 4 (variabel, geen italic) | Koppen (`h1`–`h6`) en `display-*` |

### Lopende tekst

| Token | Waarde | Waar |
|---|---|---|
| `--text-body` | 1rem (16px) | `body` op mobiel en tablet |
| `--text-body-lg` | 1.0625rem (17px) | `body` vanaf `lg` (1024px) |
| line-height `body` | 1.65 | basis; `body-lg` 1.7 |

Kleiner dan 14px komt niet voor; eyebrows en knoppen zijn 14px in hoofdletters.

### Tekst-utilities (`@utility` in globals.css)

| Class | Font | Grootte | Gebruik |
|---|---|---|---|
| `display-xl` | serif | clamp(3rem, 8vw, 6rem) | Hero-kop |
| `display-lg` | serif | clamp(2.5rem, 6vw, 4.5rem) | Grote paginakop |
| `display-md` | serif | clamp(2rem, 4vw, 3rem) | Paginakop (H1 op content-pagina's) |
| `display-sm` | serif | clamp(1.5rem, 3vw, 2.25rem) | Sectiekop |
| `body-lg` | sans | 1.0625rem / 1.7, `graphite` | Intro- en leestekst |
| `eyebrow`, `eyebrow-lg` | sans | 0.875rem, hoofdletters, `tracking-label`, `stone` | Label boven een kop |
| `badge` | sans | 0.9375rem, ink op paper | Labels op kaart en PDP |

`--tracking-label` (0.12em) is de enige letterafstand voor hoofdletterlabels.

## 3. Knoppen en formulieren

Alle knoppen zijn minimaal 44px hoog (`min-height: 2.75rem`), hebben een
zichtbare hover én de globale focusring. Afronding: 10px.

| Class | Uiterlijk | Gebruik |
|---|---|---|
| `btn-primary` | ink vlak, paper tekst; hover `accent-dark` | Eén primaire actie per scherm |
| `btn-primary-lg` | als primary, 48px hoog, 16px tekst | Afrekenen, koopknop |
| `btn-ghost` | transparant, ink rand | Secundaire actie |
| `btn-quiet` | transparant, geen rand | Tertiaire actie |
| `btn-destructive` | `error` vlak | Verwijderen (admin) |
| `btn-sm` | kleinere padding | Compacte varianten (blijft 44px hoog) |
| `btn-link` | tekstlink met onderstreping, 44px hoog | Tekstactie naast een knop |

Formulieren: `field-group`, `field-label`, `input-field` (16px tekst,
onderrand `line-strong`), `input-error`. `hp-field` is de verborgen honeypot.

### Focus

`:focus-visible` geeft overal een 2px ink-ring met 2px offset en een
paper-halo van 6px, zodat de ring ook op donkere vlakken zichtbaar is. Nooit
`outline: none` zonder vervanging.

## 4. Layout

| Token | Waarde | Gebruik |
|---|---|---|
| `--container-page` (`max-w-page`) | 1600px | Maximale paginabreedte; randen lopen overal gelijk |

Kleinste ondersteunde breedte: 320px (header), ontwerpbasis 375px.

## 5. Beweging

| Token | Waarde |
|---|---|
| `--ease-out-strong` | cubic-bezier(0.22, 1, 0.36, 1) |
| `--ease-out-soft` | cubic-bezier(0.33, 1, 0.68, 1) |
| `--ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) |
| `--dur-micro` | 150ms |
| `--dur-quick` | 280ms (knoppen, dialogen) |
| `--dur-moderate` | 480ms |
| `--dur-cinematic` | 720ms |
| `--dur-epic` | 1400ms |
| `--animate-marquee` | marquee 40s linear infinite (TopBanner) |

Alle scroll-reveal-, parallax- en tilt-effecten staan achter
`prefers-reduced-motion: no-preference`.
