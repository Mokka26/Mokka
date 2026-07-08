import { shippingInfo } from "@/lib/shipping-info";

// Statische, slanke USP-balk (minimal luxe — geen bewegende tekst).
// Toont een paar feitelijke trust-punten, gecentreerd, met fijne scheiding.
export default function TopBanner() {
  const items = [
    `Gratis verzending vanaf €${shippingInfo.freeShippingThreshold}`,
    "Persoonlijk advies in onze showroom",
    "Veilig betalen met iDEAL & creditcard",
  ];
  return (
    <div className="bg-ink text-white/75 border-b border-white/10">
      <div className="max-w-[1600px] mx-auto h-9 px-6 sm:px-10 lg:px-14 flex items-center justify-center gap-5 overflow-hidden">
        {items.map((t, i) => (
          <span key={t} className="flex items-center gap-5 whitespace-nowrap">
            {i > 0 && <span className="hidden sm:inline w-1 h-1 rounded-full bg-accent/70" aria-hidden />}
            <span
              className={`text-[10px] uppercase tracking-[0.28em] ${i === 0 ? "" : "hidden sm:inline"}`}
            >
              {t}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
