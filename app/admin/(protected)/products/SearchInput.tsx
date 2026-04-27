"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export default function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (value === (params.get("q") ?? "")) return;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      router.replace(`${pathname}?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone pointer-events-none" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Zoek op productnaam…"
        className="w-full sm:w-80 pl-10 pr-10 py-2.5 bg-white border border-line text-ink text-sm focus:outline-none focus:border-bronze"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Wissen"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-bone text-stone hover:text-ink"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
