"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeNewsletter } from "@/app/newsletter/actions";

// Het enige interactieve deel van de footer (state + server action); de rest
// van components/Footer.tsx is een server component.
export function FooterNewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — blijft leeg bij mensen
  // Anti-spam: tijd tussen mount en verzenden (performance.now(), monotone
  // klok — niet afhankelijk van de systeemtijd van de bezoeker).
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const elapsedMs = mountedAt.current === null ? undefined : Math.round(performance.now() - mountedAt.current);
    const r = await subscribeNewsletter({ email, website, elapsedMs });
    if (r.ok) {
      setStatus("done");
      setMsg("Bedankt! Check je mail om je aanmelding te bevestigen.");
      setEmail("");
      return;
    }
    setStatus("error");
    setMsg(r.error ?? "Er ging iets mis.");
  }

  if (status === "done") {
    return <p className="text-white text-base py-3" role="status">{msg}</p>;
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex items-end border-b border-white/40 focus-within:border-white transition-colors">
        {/* Honeypot: onzichtbaar voor mensen, bots vullen het in. */}
        <div className="hp-field" aria-hidden="true">
          <label htmlFor="footer-newsletter-website">Website</label>
          <input
            id="footer-newsletter-website"
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <label htmlFor="footer-newsletter-email" className="sr-only">E-mailadres voor de nieuwsbrief</label>
        <input
          id="footer-newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jouw@email.nl"
          className="flex-1 min-w-0 bg-transparent py-3 min-h-11 text-white placeholder-white/70 text-base focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="min-h-11 text-white hover:text-accent-light text-sm font-medium uppercase tracking-[0.14em] px-3 transition-colors disabled:opacity-60"
        >
          {status === "sending" ? "Bezig…" : "Aanmelden"}
        </button>
      </form>
      {status === "error" && <p className="text-error-light text-sm mt-2" role="alert">{msg}</p>}
    </>
  );
}
