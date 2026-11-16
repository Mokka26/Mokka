"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

interface Props {
  /** De hero-foto (server-gerenderd <picture>); blijft het LCP-beeld. */
  children: ReactNode;
  /** Video voor brede schermen (≥ 1600px), 1920×1080. */
  srcLarge: string;
  /** Video voor tablets en laptops (768–1599px), 1280×720. */
  srcSmall: string;
}

const LARGE_VIDEO_QUERY = "(min-width: 1600px)";

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

function shouldSkipVideo(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if (!window.matchMedia("(min-width: 768px)").matches) return true;
  const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (connection?.saveData) return true;
  return connection?.effectiveType !== undefined && /(^|-)(2g|3g)$/.test(connection.effectiveType);
}

// Levende hero: een stille, naadloos herhalende clip (AI-video gemaakt van
// dezelfde sfeerfoto, zelfde uitsnede) die over de foto heen infadet. De foto
// blijft het LCP-beeld: de video krijgt pas een src nadat de pagina geladen is
// en de browser even vrij is. Niet op mobiel, niet bij "minder beweging",
// databesparing of een trage verbinding — dan blijft het bij de foto.
// Pauzeert buiten beeld en heeft een pauzeknop (WCAG 2.2.2). De video is
// decoratief; de foto draagt de alt-tekst.
//
// Lagen zoals in Hero: buitenste beweegt mee met scrollen (.hero-drift),
// binnenste zoomt bij laden (.hero-settle); foto en video zitten samen in de
// binnenste laag zodat ze exact gelijk bewegen. De knop staat erbuiten.
export function HeroVideo({ children, srcLarge, srcSmall }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || shouldSkipVideo()) return;

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const start = () => {
      if (cancelled) return;
      // De 1920-versie (±1,2 MB) pas vanaf 1600px: op 1280–1599px is het
      // verschil met de 1280-versie (±0,4 MB) onder de scrim niet te zien.
      video.src = window.matchMedia(LARGE_VIDEO_QUERY).matches ? srcLarge : srcSmall;
      setActive(true);
      video.play().catch(() => {
        // Autoplay geweigerd: de foto blijft staan.
      });
    };
    const schedule = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(start, { timeout: 2500 });
      } else {
        timeoutId = globalThis.setTimeout(start, 1200) as unknown as number;
      }
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    const observer = new IntersectionObserver(([entry]) => {
      if (!video.getAttribute("src")) return;
      if (!entry.isIntersecting) video.pause();
      else if (!userPaused.current) video.play().catch(() => {});
    });
    observer.observe(video);

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [srcLarge, srcSmall]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  }

  return (
    <>
      <div className="absolute inset-0 hero-drift">
        <div className="absolute inset-0 hero-settle">
          {children}
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
            tabIndex={-1}
            onPlaying={() => {
              setReady(true);
              setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            data-ready={ready}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-[1500ms] ease-out data-[ready=true]:opacity-100"
          />
        </div>
      </div>

      {active && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Achtergrondvideo pauzeren" : "Achtergrondvideo afspelen"}
          className="absolute bottom-6 right-6 z-20 hidden md:inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-ink/40 text-white backdrop-blur-md hover:bg-ink/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-colors"
        >
          {playing ? (
            <Pause className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <Play className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      )}
    </>
  );
}
