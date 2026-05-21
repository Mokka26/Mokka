"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture, PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef, useState, Suspense } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Editorial wabi-sabi scene — high-res, Mokka brand
const SCENE_IMAGE = "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=2400&q=90&auto=format&fit=crop";

interface ProgressRef { current: number }

// 3D scene: background plane that responds to scroll progress
function Scene({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const texture = useTexture(SCENE_IMAGE);
  const { viewport } = useThree();

  // Aspect-aware plane sizing
  const planeWidth = viewport.width * 1.2;
  const planeHeight = (planeWidth * 9) / 16;
  // Verzeker dat de plane altijd viewport vult bij elke aspect
  const finalHeight = Math.max(planeHeight, viewport.height * 1.2);
  const finalWidth = Math.max(planeWidth, (finalHeight * 16) / 9);

  useFrame(() => {
    if (!cameraRef.current || !meshRef.current) return;
    const p = progressRef.current;

    // Camera dolly: van ver weg naar dichtbij
    cameraRef.current.position.z = 5 - p * 3.6; // 5 → 1.4
    cameraRef.current.fov = 50 - p * 18;        // 50 → 32 (zoom in)
    cameraRef.current.updateProjectionMatrix();

    // Subtle parallax + lichte vergroting
    meshRef.current.scale.setScalar(1 + p * 0.15);
    meshRef.current.position.x = p * 0.15;
    meshRef.current.position.y = -p * 0.08;
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 0, 5]}
        fov={50}
      />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[6, 4, 8]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {/* Achtergrond plane met de scene-foto */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[finalWidth, finalHeight]} />
        <meshStandardMaterial
          map={texture}
          toneMapped={false}
        />
      </mesh>
      {/* Subtiele vignette via een tweede plane */}
      <mesh position={[0, 0, 0.5]}>
        <planeGeometry args={[finalWidth * 1.2, finalHeight * 1.2]} />
        <meshBasicMaterial
          color="#1c1c1c"
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

// Loading state — voorkomt flash
function Fallback() {
  return (
    <div className="absolute inset-0 bg-bone flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
}

export default function CinematicHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const fmReducedMotion = useReducedMotion();

  useEffect(() => {
    setReducedMotion(!!fmReducedMotion);
  }, [fmReducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom top",
      scrub: 1.2,
      onUpdate: (self) => {
        progressRef.current = self.progress;
        // Update HTML overlay
        if (overlayRef.current) {
          const els = overlayRef.current.querySelectorAll<HTMLElement>("[data-stage]");
          els.forEach((el) => {
            const stage = Number(el.dataset.stage);
            const in1 = stage === 1 && self.progress < 0.4;
            const in2 = stage === 2 && self.progress >= 0.4 && self.progress < 0.75;
            const in3 = stage === 3 && self.progress >= 0.75;
            const active = in1 || in2 || in3;
            gsap.to(el, {
              opacity: active ? 1 : 0,
              y: active ? 0 : (stage === 1 ? -20 : 30),
              duration: 0.6,
              ease: "power2.out",
              overwrite: true,
            });
          });
        }
      },
    });

    return () => { trigger.kill(); };
  }, [reducedMotion]);

  // Reduced-motion fallback: statisch hero met fade-in
  if (reducedMotion) {
    return (
      <section className="relative h-[88vh] overflow-hidden bg-bone">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${SCENE_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-ink/10 to-transparent" />
        <div className="relative z-10 h-full flex items-end pb-20 lg:pb-32">
          <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
              className="max-w-2xl text-white"
            >
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/70 mb-5">
                Mokka — Voorjaar 2026
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl leading-[1.02] mb-7">
                Stille kracht.<br />
                <span className="italic">Eerlijke materialen.</span>
              </h1>
              <Link
                href="/products"
                className="inline-flex items-center gap-3 bg-white text-ink px-7 py-4 rounded-[10px] text-[11px] uppercase tracking-[0.22em] hover:bg-accent hover:text-white transition-colors"
              >
                Ontdek de collectie
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="relative h-[280vh] bg-bone"
      aria-label="Mokka Voorjaar collectie cinematic hero"
    >
      {/* Sticky viewport — blijft staan tijdens scroll */}
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Three.js Canvas */}
        <div className="absolute inset-0">
          <Suspense fallback={<Fallback />}>
            <Canvas
              dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)]}
              gl={{
                antialias: true,
                powerPreference: "high-performance",
                alpha: false,
              }}
              style={{ background: "#EEEAE3" }}
              shadows
            >
              <Scene progressRef={progressRef} />
            </Canvas>
          </Suspense>
        </div>

        {/* Gradient-overlay voor leesbaarheid tekst */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-ink/15 to-ink/20 pointer-events-none" />

        {/* HTML overlay — text die fade-in/out doet per stage */}
        <div
          ref={overlayRef}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14 w-full text-center text-white">
            {/* Stage 1 — opening (0-40%) */}
            <div
              data-stage="1"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 sm:px-10 lg:px-14"
              style={{ opacity: 1 }}
            >
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-white/75 mb-6">
                Mokka Home Interior · Voorjaar 2026
              </p>
              <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl xl:text-8xl leading-[1] mb-2">
                Stille kracht.
              </h1>
              <h1 className="font-serif italic text-4xl sm:text-6xl lg:text-7xl xl:text-8xl leading-[1] text-accent">
                Eerlijke materialen.
              </h1>
            </div>

            {/* Stage 2 — diepte (40-75%) */}
            <div
              data-stage="2"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 sm:px-10 lg:px-14"
              style={{ opacity: 0 }}
            >
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-white/75 mb-6">
                — De Collectie
              </p>
              <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.1] max-w-3xl mx-auto">
                Gemaakt voor het moderne thuis — handgemaakt,
                <span className="italic text-accent"> tijdloos</span>.
              </h2>
            </div>

            {/* Stage 3 — close-up CTA (75-100%) */}
            <div
              data-stage="3"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 sm:px-10 lg:px-14 pointer-events-auto"
              style={{ opacity: 0 }}
            >
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-white/75 mb-6">
                Ontdek meer
              </p>
              <h3 className="font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.05] mb-10 max-w-2xl mx-auto">
                Van bank tot lichtbron — <span className="italic">altijd Mokka</span>.
              </h3>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-3 bg-white text-ink px-7 py-4 rounded-[10px] text-[11px] uppercase tracking-[0.22em] hover:bg-accent hover:text-white transition-colors"
                >
                  Bekijk de collectie
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </Link>
                <Link
                  href="/banken"
                  className="inline-flex items-center gap-3 border border-white/60 text-white px-7 py-4 text-[11px] uppercase tracking-[0.22em] hover:bg-white hover:text-ink transition-colors"
                >
                  Voorjaar Banken
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll-hint onderaan */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/70">
          <p className="text-[10px] uppercase tracking-[0.3em]">Scroll</p>
          <div className="w-[1px] h-10 bg-white/40 relative overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-1/2 bg-white animate-[scroll-line_1.8s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    </section>
  );
}
