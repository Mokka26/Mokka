"use client";

// Wrapper rond CinematicHero met dynamic ssr:false. Three.js + GSAP +
// react-three (~1100KB) wordt zo NIET meegebundled in de server-render
// of de initial client-bundle van homepage. Pas na hydration laadt het
// async — fallback hieronder vult de hero-ruimte ondertussen.
//
// ssr:false vereist Client Component → vandaar deze wrapper, omdat
// app/page.tsx Server Component is.

import dynamic from "next/dynamic";

function HeroFallback() {
  return (
    <section
      className="relative h-[280vh] bg-bone"
      aria-label="Hero — laden..."
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-bone">
        {/* Statische bg-image vult de viewport boven de vouw — voorkomt
            lege ruimte tijdens Three.js client-bundle download */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=1600&q=80&auto=format&fit=crop")',
          }}
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
