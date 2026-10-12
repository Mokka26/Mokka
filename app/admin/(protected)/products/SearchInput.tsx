"use client";

import { useEffect, useId, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Zoekveld met debounce; navigeert zelf (behoudt overige filters) en heeft
 * `name="q"` zodat het ook meegaat bij een gewone formulier-submit.
 */
export default function SearchInput({ placeholder = "Zoek op naam, slug of kleurgroep…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const id = useId();

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (value.trim() === (params.get("q") ?? "")) return;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);

  return (
    <div>
      <label htmlFor={id} className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5">
        Zoeken
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone pointer-events-none" />
        <input
          id={id}
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full sm:w-80 min-h-11 pl-10 pr-11 py-2.5 bg-white border border-line text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Zoekopdracht wissen"
            className="absolute right-0 top-0 h-full w-11 inline-flex items-center justify-center text-stone hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
