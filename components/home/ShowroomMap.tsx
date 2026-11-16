"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ArrowUpRight, MapPin } from "lucide-react";
import { getCookieConsent } from "@/components/CookieBanner";

interface Props {
  /** Google Maps-embed-URL (lib/business-info getMapsEmbedUrl). */
  embedUrl: string;
  /** Gewone Google Maps-link voor "Open in Google Maps". */
  mapsUrl: string;
  /** Foto van de showroom als voorvertoning (lokaal bestand in public/). */
  posterSrc: string;
  /** Adres op één regel, voor de voorvertoning en de iframe-titel. */
  address: string;
  showroomName: string;
}

function subscribeConsent(onChange: () => void) {
  window.addEventListener("cookieConsentChanged", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("cookieConsentChanged", onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Google Maps-kaart van de showroom, privacyvriendelijk: Google Maps plaatst
// cookies, dus de kaart laadt pas na "Accepteren" in de cookiemelding of na
// een klik op "Kaart laden". Tot dan een foto van de showroom met het adres;
// er gaat dan niets naar Google. Ook zonder kaart is de route bereikbaar via
// de link. De kaart is licht ontkleurd zodat hij rustig in het ontwerp past.
export function ShowroomMap({ embedUrl, mapsUrl, posterSrc, address, showroomName }: Props) {
  const [requested, setRequested] = useState(false);
  const consent = useSyncExternalStore(subscribeConsent, getCookieConsent, () => null);
  const showMap = requested || consent === "accepted";

  return (
    // Mobiel: foto vrij (het gevelbord blijft zichtbaar) met adres en knoppen
    // eronder op ink; vanaf sm liggen tekst en knoppen als overlay op de foto.
    <div className="relative overflow-hidden rounded-[14px] bg-ink">
      <div className="relative aspect-[4/3] bg-bone">
        {showMap ? (
          <iframe
            src={embedUrl}
            title={`Kaart met de locatie van ${showroomName}, ${address}`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0 saturate-[.35]"
          />
        ) : (
          <>
            <Image
              src={posterSrc}
              alt={`De showroom van ${showroomName}`}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
            <div className="absolute inset-0 hidden sm:block bg-gradient-to-t from-ink/80 via-ink/30 to-ink/5" aria-hidden />
          </>
        )}
      </div>
      {!showMap && (
        <div className="p-5 sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-8 text-white">
          <p className="flex items-start gap-2 text-base sm:text-lg font-medium mb-1">
            <MapPin className="w-5 h-5 mt-0.5 shrink-0" strokeWidth={1.5} aria-hidden />
            {address}
          </p>
          <p className="text-sm text-white/85 mb-5 max-w-md">
            De kaart komt van Google Maps. Bij het laden kan Google cookies plaatsen.
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={() => setRequested(true)}
              className="inline-flex items-center justify-center min-h-11 px-6 rounded-[10px] bg-white text-ink text-sm font-medium uppercase tracking-label hover:bg-accent-dark hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-colors"
            >
              Kaart laden
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-11 text-sm font-medium uppercase tracking-label text-white underline decoration-white/50 underline-offset-[6px] hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Open in Google Maps
              <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
