"use client";

// Wrapper rond CinematicHero met dynamic ssr:false. Three.js + GSAP +
// react-three (~1100KB) wordt zo NIET meegebundled in de server-render
// of de initial client-bundle van homepage. Pas na hydration laadt het
// async — fallback hieronder vult de hero-ruimte ondertussen.
//
// ssr:false vereist Client Component → vandaar deze wrapper, omdat
// app/page.tsx Server Component is.

import dynamic from "next/dynamic";
import { HERO_IMAGE } from "@/lib/hero-image";

function HeroFallback() {
  return (
    <section
      className="relative h-[280vh] bg-bone"
      aria-label="Hero — laden..."
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-bone">
        {/* Zelfde foto als de Three.js-scene (identieke URL) → één download,
            geen zichtbare beeldwissel wanneer de 3D-hero de fallback vervangt. */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url("${HERO_IMAGE}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-ink/15 to-ink/20" />
      </div>
    </section>
  );
}

const CinematicHero = dynamic(() => import("./CinematicHero"), {
  ssr: false,
  loading: () => <HeroFallback />,
});

export default function CinematicHeroLazy() {
  return <CinematicHero />;
}
