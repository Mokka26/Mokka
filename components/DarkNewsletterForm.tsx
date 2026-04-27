"use client";

export default function DarkNewsletterForm() {
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
    >
      <input
        type="email"
        placeholder="jouw@email.nl"
        className="flex-1 bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-0 focus:outline-none focus:border-white transition-colors text-sm"
      />
      <button
        type="submit"
        className="bg-white text-ink px-8 py-3 text-[11px] uppercase tracking-[0.25em] font-medium hover:bg-bronze hover:text-white transition-colors"
      >
        Aanmelden
      </button>
    </form>
  );
}
