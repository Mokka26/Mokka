# Mokka Home Interior

Premium online interieurwinkel gebouwd met Next.js 16, React 19, Tailwind CSS v4, Prisma en Cloudinary.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS v4, Framer Motion, Lenis
- **Database:** Prisma + SQLite (dev) / PostgreSQL (prod)
- **Afbeeldingen:** Cloudinary CDN
- **Taal:** TypeScript

## Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Kopieer env template
cp .env.example .env.local

# Vul je credentials in .env.local

# Prisma client genereren
npx prisma generate

# Database setup
npx prisma db push

# Seed database
npm run seed

# Dev server
npm run dev
```

## Scripts

```bash
npm run dev          # Dev server met Turbopack
npm run build        # Productie build
npm run start        # Productie server
npm run seed         # Database vullen met producten
```

## Structuur

```
app/              # Next.js App Router pagina's
components/       # React componenten
lib/              # Utilities (prisma, cloudinary)
prisma/           # Database schema + seed
scripts/          # Upload scripts (Cloudinary)
public/           # Statische bestanden (logo, video)
```
