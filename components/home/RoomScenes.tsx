"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cldOptimize } from "@/lib/cloudinary-url";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import type { HomeRoom } from "@/lib/home-scenes";

export type RoomSceneData = HomeRoom & { count: number };

const pad = (n: number) => String(n).padStart(2, "0");

// Desktop: links een vaststaand beeld dat wisselt (crossfade + lichte zoom)
// zodra de tekst van de volgende kamer het midden van het scherm passeert;
// rechts scrollt de tekst. Geen carrousel: alle inhoud staat in de HTML en
// de bezoeker bepaalt het tempo. Mobiel: per kamer gewoon beeld + tekst.
// "Minder beweging": de wissel gebeurt zonder overgang (motion-safe).
export function RoomScenes({ rooms }: { rooms: RoomSceneData[] }) {
  const [active, setActive] = useState(0);
  const panels = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isFinite(i)) setActive(i);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const el of panels.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-16">
      {/* Vaststaand beeld (alleen desktop) */}
      <div className="hidden lg:block lg:col-span-7">
        <div className="sticky top-28 h-[calc(100svh-9rem)] min-h-[28rem] overflow-hidden rounded-[14px] bg-bone">
          {rooms.map((room, i) => (
            <div
              key={room.key}
              className={`absolute inset-0 motion-safe:transition-[opacity,transform] motion-safe:duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                i === active ? "opacity-100 scale-100" : "opacity-0 scale-[1.06]"
              }`}
              aria-hidden={i !== active}
            >
              <CloudinaryImage
                src={cldOptimize(room.image, { ar: "4:5", w: 1200, mode: "fill", quality: "auto:eco" })}
                alt={room.alt}
                fill
                sizes="(max-width: 1024px) 1px, 55vw"
                maxWidth={1080}
                className="object-cover"
              />
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/60 to-transparent" aria-hidden />
          <div className="absolute left-6 bottom-6 right-6 flex items-end justify-between text-white" aria-hidden>
            <span className="font-serif text-3xl">{rooms[active]?.room}</span>
            <span className="text-sm font-medium tracking-label tabular-nums">
              {pad(active + 1)} / {pad(rooms.length)}
            </span>
          </div>
          {/* Voortgang */}
          <div className="absolute top-6 left-6 right-6 flex gap-2" aria-hidden>
            {rooms.map((room, i) => (
              <span key={room.key} className="h-0.5 flex-1 bg-white/30 overflow-hidden rounded-full">
                <span
                  className={`block h-full bg-white origin-left motion-safe:transition-transform motion-safe:duration-700 ${
                    i <= active ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tekst per kamer */}
      <div className="lg:col-span-5 space-y-16 lg:space-y-0">
        {rooms.map((room, i) => (
          <div
            key={room.key}
            ref={(el) => {
              panels.current[i] = el;
            }}
            data-index={i}
            className="lg:min-h-[85svh] lg:flex lg:items-center"
          >
            <div className="reveal w-full">
              <div className="lg:hidden relative aspect-[4/5] overflow-hidden rounded-[14px] bg-bone mb-8">
                <CloudinaryImage
                  src={cldOptimize(room.image, { ar: "4:5", w: 900, mode: "fill", quality: "auto:eco" })}
                  alt={room.alt}
                  fill
                  sizes="(min-width: 1024px) 1px, 100vw"
                  maxWidth={1080}
                  className="object-cover"
                />
              </div>
              <p className="flex items-center gap-4 text-sm font-medium uppercase tracking-label text-accent-dark mb-5">
                <span className="font-serif italic normal-case text-base tracking-normal">{pad(i + 1)}</span>
                <span className="h-px w-8 bg-accent" aria-hidden />
                {room.room}
              </p>
              <h3 className="display-md text-ink mb-5">{room.title}</h3>
              <p className="body-lg max-w-md mb-8">{room.text}</p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <Link href={`/${room.category}`} className="btn-primary text-sm group">
                  {room.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} aria-hidden />
                </Link>
                {room.count > 0 && (
                  <span className="text-base text-slate tabular-nums">{room.count} producten</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
