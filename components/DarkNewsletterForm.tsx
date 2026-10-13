"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { subscribeNewsletter } from "@/app/newsletter/actions";
import { businessInfo } from "@/lib/business-info";

export default function DarkNewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  // Spam-bescherming: `website` moet leeg blijven en `elapsedMs` is de tijd
  // tussen mount en verzenden (te snelle inzendingen zijn bots). Zelfde
  // aanpak als components/FooterNewsletterForm.tsx: performance.now() is een
  // monotone klok, onafhankelijk van de systeemtijd van de bezoeker.
  const [website, setWebsite] = useState("");
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const elapsedMs = mountedAt.current === null ? undefined : Math.round(performance.now() - mountedAt.current);
    const r = await subscribeNewsletter({ email, website, elapsedMs });
    if (r.ok) { setStatus("done"); setMsg("Check je mail om je aanmelding te bevestigen."); setEmail(""); }
    else { setStatus("error"); setMsg(r.error ?? "Er ging iets mis."); }
  }

  if (status === "done") {
    return <p className="text-white/80 text-base max-w-md mx-auto text-center" role="status">{msg}</p>;
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        {/* Honeypot: onzichtbaar voor mensen, bots vullen het in. */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="nl-website">Laat dit veld leeg</label>
          <input
            id="nl-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <label htmlFor="nl-email" className="sr-only">E-mailadres voor de nieuwsbrief</label>
        <input
          id="nl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jouw@email.nl"
          // Zichtbare focus: de onderlijn (altijd 2px, dus geen verspringen)
          // wordt wit bij focus — vervangt de standaard outline.
          className="flex-1 min-h-11 bg-transparent border-b-2 border-white/40 text-white placeholder-white/60 py-3 px-0 focus-visible:outline-none focus-visible:border-white transition-colors text-base"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="min-h-11 bg-white text-ink px-8 py-3 rounded-[10px] text-sm uppercase tracking-[0.08em] font-medium hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors disabled:opacity-60"
        >
          {status === "sending" ? "Bezig…" : "Aanmelden"}
        </button>
        {status === "error" && <p className="text-error-light text-sm w-full sm:w-auto" role="alert">{msg}</p>}
      </form>
      {/* Zelfde frequentie-belofte als de footer (components/Footer.tsx). */}
      <p className="text-sm text-white/70 mt-6 max-w-md mx-auto text-center leading-[1.6]">
        Maximaal 2x per maand. Uitschrijven kan altijd.{" "}
        <Link
          href={businessInfo.legal.privacyPolicyUrl}
          className="underline underline-offset-4 hover:text-white"
        >
          Lees ons privacybeleid
        </Link>
        .
      </p>
    </>
  );
}
