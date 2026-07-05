"use client";

import { useState } from "react";
import { subscribeNewsletter } from "@/app/newsletter/actions";

export default function DarkNewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const r = await subscribeNewsletter(email);
    if (r.ok) { setStatus("done"); setMsg("Bedankt — je bent aangemeld."); setEmail(""); }
    else { setStatus("error"); setMsg(r.error ?? "Er ging iets mis."); }
  }

  if (status === "done") {
    return <p className="text-white/80 text-sm max-w-md mx-auto text-center" role="status">{msg}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <label htmlFor="nl-email" className="sr-only">E-mailadres voor de nieuwsbrief</label>
      <input
        id="nl-email"
        name="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="jouw@email.nl"
        className="flex-1 bg-transparent border-b border-white/40 text-white placeholder-white/60 py-3 px-0 focus-visible:outline-none focus:border-white transition-colors text-base"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="bg-white text-ink px-8 py-3 rounded-[10px] text-[11px] uppercase tracking-[0.25em] font-medium hover:bg-accent hover:text-white transition-colors disabled:opacity-60"
      >
        {status === "sending" ? "Bezig…" : "Aanmelden"}
      </button>
      {status === "error" && <p className="text-red-300 text-xs w-full sm:w-auto" role="alert">{msg}</p>}
    </form>
  );
}
