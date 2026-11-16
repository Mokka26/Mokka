"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { trackSearch } from "@/lib/analytics";
import { Dialog } from "@/components/ui/Dialog";
import { SEARCH_DIALOG_ID } from "@/lib/events";

const POPULAR_SEARCHES = ["Hoekbank", "Eettafel", "Fauteuil", "Boxspring"];

/**
 * Zoekdialoog (volledig scherm, focus direct in het veld). Losse module die de
 * Navbar pas laadt bij de eerste klik op Zoeken (next/dynamic), zodat hij niet
 * in de JS van elke pagina zit.
 */
export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const search = (term: string) => {
    trackSearch(term);
    router.push(`/products?q=${encodeURIComponent(term)}`);
    onClose();
    setSearchQuery("");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    search(q);
  };

  return (
    <Dialog
      id={SEARCH_DIALOG_ID}
      size="full"
      open={open}
      onClose={onClose}
      title="Zoeken"
      initialFocusRef={searchInputRef}
    >
      {/* Het veld staat bovenaan, direct onder de titelbalk — niet verticaal
          gecentreerd (op mobiel met toetsenbord open is de helft van het
          scherm anders leeg). */}
      <div>
        <form onSubmit={handleSearch} role="search" className="w-full max-w-4xl mx-auto px-6 sm:px-10 lg:px-14 pt-4 sm:pt-8 pb-10">
          <label htmlFor="site-search-input" className="sr-only">Zoek in de webshop</label>
          <div className="relative">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-stone" strokeWidth={1.25} aria-hidden="true" />
            <input
              ref={searchInputRef}
              id="site-search-input"
              type="search"
              name="q"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Wat zoek je?"
              autoComplete="off"
              enterKeyHint="search"
              className="w-full text-2xl sm:text-4xl lg:text-5xl font-serif py-6 pl-12 sm:pl-16 bg-transparent border-0 border-b border-line-strong focus:outline-none focus:border-ink transition-colors"
            />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <p className="eyebrow w-full mb-1">Veel gezocht</p>
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                // Direct zoeken (voorheen vulde de chip alleen het veld).
                onClick={() => search(term)}
                className="inline-flex items-center min-h-11 px-4 rounded-full border border-line-strong text-base text-ink hover:border-ink hover:bg-bone transition-colors"
              >
                {term}
              </button>
            ))}
            <button type="submit" className="btn-primary btn-sm ml-auto">
              Zoeken
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
