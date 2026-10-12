import { shippingInfo } from "@/lib/shipping-info";

// Slanke USP-balk boven de header. Drie feitelijke trust-punten uit
// lib/shipping-info. Vanaf `sm` naast elkaar; op mobiel wisselen ze rustig
// via CSS (`.topbanner-item` in app/globals.css) — geen carousel-library,
// en bij prefers-reduced-motion staat alleen de eerste stil.
export default function TopBanner() {
  const items = [
    shippingInfo.freeShippingCopyShort,
    "Persoonlijk advies in onze showroom",
    shippingInfo.paymentCopyShort,
  ];
  return (
    <div className="bg-ink text-white/85 border-b border-white/10">
      <ul className="relative max-w-[1600px] mx-auto h-9 px-6 sm:px-10 lg:px-14 flex items-center justify-center gap-6 overflow-hidden list-none m-0 p-0">
        {items.map((t, i) => (
          <li
            key={t}
            className={`topbanner-item topbanner-item-${i + 1} flex items-center gap-6 whitespace-nowrap text-[13px] tracking-[0.04em]`}
          >
            {i > 0 && <span className="hidden sm:inline w-1 h-1 rounded-full bg-accent-light" aria-hidden="true" />}
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
