import { shippingInfo } from "@/lib/shipping-info";
import { BLACK_FRIDAY_BANNER, isGiftActive } from "@/lib/campaign";

// Slanke USP-balk boven de header. Drie feitelijke trust-punten uit
// lib/shipping-info. Vanaf `sm` naast elkaar; op mobiel staat alleen de
// eerste statisch in beeld — geen automatische rotatie (WCAG 2.2.2: bewegende
// content zonder pauzeknop) en geen carousel-library.
// Tijdens een actie (lib/campaign) staat de actie vooraan; op mobiel alleen
// de korte actietekst, op desktop daarnaast de verzend-USP.
export default function TopBanner() {
  if (isGiftActive()) {
    return (
      <div className="bg-ink text-paper border-b border-graphite">
        <ul className="max-w-page mx-auto h-9 px-6 sm:px-10 lg:px-14 flex items-center justify-center gap-6 overflow-hidden list-none m-0 p-0">
          <li className="flex items-center whitespace-nowrap text-sm tracking-[0.04em] font-medium text-accent-light">
            <span className="md:hidden">{BLACK_FRIDAY_BANNER.short}</span>
            <span className="hidden md:inline">{BLACK_FRIDAY_BANNER.long}</span>
          </li>
          <li className="hidden lg:flex items-center gap-6 whitespace-nowrap text-sm tracking-[0.04em]">
            <span className="w-1 h-1 rounded-full bg-accent-light" aria-hidden="true" />
            <span>{shippingInfo.freeShippingCopyShort}</span>
          </li>
        </ul>
      </div>
    );
  }

  const items = [
    shippingInfo.freeShippingCopyShort,
    "Persoonlijk advies in onze showroom",
    shippingInfo.paymentCopyShort,
  ];
  return (
    <div className="bg-ink text-paper border-b border-graphite">
      <ul className="max-w-page mx-auto h-9 px-6 sm:px-10 lg:px-14 flex items-center justify-center gap-6 overflow-hidden list-none m-0 p-0">
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
