import Image from "next/image";
import { businessInfo } from "@/lib/business-info";
import type { CheckoutMethod } from "@/lib/mollie";

/**
 * Betaalmethode-logo's — monochrome witte wordmarks (zelf-gehost in
 * /public/payment/). Strak en consistent op de donkere footer, zonder
 * achtergrond of kader.
 *
 * `tone="dark"` keert de witte wordmarks om (CSS-filter) voor lichte
 * achtergronden: PDP-koopblok, checkout-knop, cart-overzicht.
 *
 * NB: bij de Mollie-checkout-integratie kun je op de checkout (lichte bg) de
 * officiële full-color iconen uit Mollie /v2/methods tonen; deze witte set is
 * specifiek voor de donkere footer.
 */
const FILES: Record<string, string> = {
  ideal: "ideal",
  visa: "visa",
  mastercard: "mastercard",
  bancontact: "bancontact",
  applepay: "applepay",
  klarna: "klarna",
  paypal: "paypal",
};

type Tone = "light" | "dark";

export function PaymentIcon({
  name,
  tone = "light",
  compact = false,
}: {
  name: string;
  /** `light` = wit (donkere bg, footer); `dark` = ink (lichte bg). */
  tone?: Tone;
  /** Kleinere hoogte (16px) voor koopblok/checkout. */
  compact?: boolean;
}) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  const file = FILES[key];
  const height = compact ? "h-4" : "h-5";
  if (!file) {
    return (
      <span className={`text-xs font-semibold ${tone === "dark" ? "text-ink" : "text-white/85"}`}>{name}</span>
    );
  }
  return (
    <Image
      src={`/payment/${file}.svg`}
      alt={name}
      width={64}
      height={24}
      unoptimized
      className={`${height} w-auto block ${tone === "dark" ? "invert-[0.92]" : ""}`}
    />
  );
}

/**
 * Live betaalmethoden uit Mollie als kleuricoon op een witte chip — dezelfde
 * opmaak in de footer en in het koopblok op de productpagina. Op een lichte
 * achtergrond (`tone="dark"`) krijgt de chip een dunne rand zodat hij zichtbaar
 * blijft. Lege lijst (geen Mollie-key of fout) → niets renderen; de aanroeper
 * valt dan terug op `PaymentIconRow`.
 */
export function MolliePaymentChips({
  methods,
  tone = "light",
  className = "",
}: {
  methods: ReadonlyArray<CheckoutMethod>;
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
 * Rij met alle geaccepteerde betaalmethoden uit lib/business-info.ts.
 * Gebruikt in PDP-koopblok, cart en checkout (lichte achtergrond → tone=dark).
 */
export function PaymentIconRow({
  tone = "dark",
  compact = true,
  className = "",
}: {
  tone?: Tone;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ul
      aria-label="Betaalmethoden"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}
    >
      {businessInfo.paymentMethods.map((m) => (
        <li key={m.name} className="inline-flex items-center">
          <PaymentIcon name={m.name} tone={tone} compact={compact} />
        </li>
      ))}
    </ul>
  );
}
