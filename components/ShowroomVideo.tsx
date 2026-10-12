"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

interface Props {
  src: string;
  poster: string;
  /** Korte omschrijving voor screenreaders (video heeft geen geluid/ondertitels). */
  label: string;
}

// Sfeervideo van de showroom. Geen autoplay-attribuut: de video start pas als
// hij in beeld komt én de gebruiker geen "minder beweging" heeft ingesteld,
// en pauzeert buiten beeld (bespaart CPU/data). preload="none" + poster: er
// wordt niets gedownload tot dat moment. Altijd een zichtbare pauzeknop.
export default function ShowroomVideo({ src, poster, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay geweigerd (databesparing, browserbeleid) — poster blijft staan.
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  return (
    <div className="relative aspect-video overflow-hidden bg-bone rounded-[10px]">
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={src} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Video pauzeren" : "Video afspelen"}
        className="absolute bottom-4 right-4 inline-flex items-center gap-2 min-h-11 min-w-11 px-4 py-2 rounded-full bg-paper/95 text-ink text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink transition-colors"
      >
        {playing ? (
          <Pause className="w-4 h-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <Play className="w-4 h-4" strokeWidth={1.75} aria-hidden />
        )}
        <span>{playing ? "Pauzeer" : "Speel af"}</span>
      </button>
    </div>
  );
}
