import Image from "next/image";

/**
 * Betaalmethode-logo's — officiële merk-SVG's, zelf-gehost in /public/payment/.
 * Bronnen: Mollie (ideal, bancontact, applepay, klarna, paypal), Wikimedia
 * (mastercard), simpleicons (visa). Dezelfde set hergebruiken we bij de
 * Mollie-checkout-integratie (Mollie levert de iconen ook via /v2/methods).
 *
 * Op een witte chip zodat de merkkleuren correct tonen op de donkere footer.
 */
const FILES: Record<string, string> = {
  ideal: "ideal",
  visa: "visa",
  mastercard: "mastercard",
  bancontact: "bancontact",
  applepay: "applepay",
  klarna: "klarna",
  paypal: "paypal",
  creditcard: "creditcard",
};

export function PaymentIcon({ name }: { name: string }) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  const file = FILES[key];
  return (
    <span className="h-11 px-3.5 inline-flex items-center justify-center bg-white rounded-lg shadow-sm">
      {file ? (
        <Image
          src={`/payment/${file}.svg`}
          alt={name}
          width={52}
          height={34}
          unoptimized
          className="h-7 w-auto block"
        />
      ) : (
        <span className="text-xs font-semibold text-ink">{name}</span>
      )}
    </span>
  );
}
