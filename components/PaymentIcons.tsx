import Image from "next/image";

/**
 * Betaalmethode-logo's — monochrome witte wordmarks (zelf-gehost in
 * /public/payment/). Strak en consistent op de donkere footer, zonder
 * achtergrond of kader.
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

export function PaymentIcon({ name }: { name: string }) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  const file = FILES[key];
  if (!file) {
    return <span className="text-xs font-semibold text-white/85">{name}</span>;
  }
  return (
    <Image
      src={`/payment/${file}.svg`}
      alt={name}
      width={64}
      height={24}
      unoptimized
      className="h-5 w-auto block"
    />
  );
}
