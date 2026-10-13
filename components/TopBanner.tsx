import { shippingInfo } from "@/lib/shipping-info";

// Slanke USP-balk boven de header. Drie feitelijke trust-punten uit
// lib/shipping-info. Vanaf `sm` naast elkaar; op mobiel staat alleen de
// eerste statisch in beeld — geen automatische rotatie (WCAG 2.2.2: bewegende
// content zonder pauzeknop) en geen carousel-library.
export default function TopBanner() {
  const items = [
    shippingInfo.freeShippingCopyShort,
    "Persoonlijk advies in onze showroom",
    shippingInfo.paymentCopyShort,
  ];
  return (
    <div className="bg-ink text-paper border-b border-graphite">
      <ul className="max-w-[1600px] mx-auto h-9 px-4 sm:px-10 lg:px-14 flex items-center justify-center gap-6 overflow-hidden list-none m-0 p-0">
        {items.map((t, i) => (
          <li
            key={t}
            className={`${i > 0 ? "hidden sm:flex" : "flex"} items-center gap-6 whitespace-nowrap text-sm tracking-[0.04em]`}
          >
            {i > 0 && <span className="w-1 h-1 rounded-full bg-accent-light" aria-hidden="true" />}
            <span className="truncate">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
