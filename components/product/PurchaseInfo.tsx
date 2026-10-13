import Link from "next/link";
import { Truck, Clock, RotateCcw, Phone, Armchair } from "lucide-react";
import { shippingInfo, warrantyYearsFor } from "@/lib/shipping-info";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { formatPrice } from "@/components/ui/price";
import { PaymentIconRow } from "@/components/PaymentIcons";
import { deliveryLine } from "@/components/product/deliveryTime";

interface Props {
  price: number;
  stock: number;
  deliveryTime: string | null;
  category: string;
}

/**
 * Koopblok direct onder de koopknop: verzendkosten, levertijd, bedenktijd,
 * garantie, betaalmethoden en contact. Alle waarden uit lib/shipping-info en
 * lib/business-info — nergens hardcoded.
 */
export function PurchaseInfo({ price, stock, deliveryTime, category }: Props) {
  const freeShipping = price >= shippingInfo.freeShippingThreshold;
  const inStock = stock > 0;
  const phoneLink = getPhoneLink();
  const warrantyYears = warrantyYearsFor(category);
  const rowClass = "flex items-start gap-3 text-[15px] leading-relaxed text-ink";
  const iconClass = "w-[18px] h-[18px] mt-[3px] shrink-0 text-accent";

  return (
    <div className="border-t border-line pt-6 mt-2 mb-8">
      <ul className="space-y-2.5">
        <li className={rowClass}>
          <Truck className={iconClass} strokeWidth={1.5} aria-hidden="true" />
          <span>
            {freeShipping ? (
              <>Gratis verzending in Nederland en België.</>
            ) : (
              <>
                Verzendkosten {formatPrice(shippingInfo.rates.standard)} — gratis vanaf{" "}
                {formatPrice(shippingInfo.freeShippingThreshold)}.
              </>
            )}
          </span>
        </li>
        <li className={rowClass}>
          <Clock className={iconClass} strokeWidth={1.5} aria-hidden="true" />
          <span>
            {inStock ? (
              <>{deliveryLine(deliveryTime)}.</>
            ) : (
              <>Tijdelijk uitverkocht — bel ons voor de verwachte levertijd.</>
            )}
          </span>
        </li>
        <li className={rowClass}>
          <RotateCcw className={iconClass} strokeWidth={1.5} aria-hidden="true" />
          <span>
            {shippingInfo.returnWindowDays} dagen bedenktijd —{" "}
            <Link href={businessInfo.legal.returnPolicyUrl} className="underline underline-offset-4 hover:text-accent">
              zo werkt retourneren
            </Link>
            .{warrantyYears > 0 && <> {warrantyYears} jaar garantie op fabrieks- en materiaalfouten.</>}
          </span>
        </li>
        {phoneLink && businessInfo.contact.phoneFormatted && (
          <li className={rowClass}>
            <Phone className={iconClass} strokeWidth={1.5} aria-hidden="true" />
            <span>
              Vragen? Bel{" "}
              <a href={phoneLink} className="underline underline-offset-4 hover:text-accent whitespace-nowrap">
                {businessInfo.contact.phoneFormatted}
              </a>
            </span>
          </li>
        )}
        <li className={rowClass}>
          <Armchair className={iconClass} strokeWidth={1.5} aria-hidden="true" />
          <span>
            Of kom proefzitten in{" "}
            <Link href="/contact" className="underline underline-offset-4 hover:text-accent">
              onze showroom in {businessInfo.address.city}
            </Link>
            .
          </span>
        </li>
      </ul>
      <PaymentIconRow className="mt-5" />
    </div>
  );
}
