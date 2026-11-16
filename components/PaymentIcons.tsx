import Image from "next/image";
import { fallbackPaymentMethods, type PaymentMethodView } from "@/lib/payment-methods";

type Tone = "light" | "dark";

/**
 * Betaalmethoden als officieel kleuricoon op een witte chip — overal dezelfde
 * opmaak: footer, koopblok, winkelwagen, checkout en /betalen. De iconen zijn
 * zelf gehost (lib/payment-methods). Op een lichte achtergrond (`tone="dark"`)
 * krijgt de chip een dunne rand zodat hij zichtbaar blijft.
 */
export function MolliePaymentChips({
  methods,
  tone = "light",
  className = "",
}: {
  methods: ReadonlyArray<PaymentMethodView>;
  tone?: Tone;
  className?: string;
}) {
  if (methods.length === 0) return null;
  const chip = `bg-white rounded-md h-8 px-2 inline-flex items-center ${tone === "dark" ? "border border-line" : ""}`;
  return (
    <ul aria-label="Betaalmethoden" className={`flex flex-wrap items-center gap-2 list-none m-0 p-0 ${className}`}>
      {methods.map((m) => (
        <li key={m.id}>
          {m.image ? (
            <span className={chip} title={m.description}>
              <Image src={m.image} alt={m.description} width={40} height={24} unoptimized className="h-5 w-auto" />
            </span>
          ) : (
            <span className={`text-sm font-semibold ${tone === "dark" ? "text-ink" : "text-white/85"}`}>{m.description}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Dezelfde chips met de vaste lijst uit lib/business-info — voor als de live
 * Mollie-lijst (tijdelijk) leeg is.
 */
export function PaymentIconRow({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return <MolliePaymentChips methods={fallbackPaymentMethods()} tone={tone} className={className} />;
}
