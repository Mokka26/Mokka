import { Truck, Clock, ShieldCheck } from "lucide-react";
import { shippingInfo, warrantyYearsFor } from "@/lib/shipping-info";
import { formatPrice } from "@/components/ui/price";
import { MolliePaymentChips, PaymentIconRow } from "@/components/PaymentIcons";
import { deliveryLine } from "@/components/product/deliveryTime";
import type { CheckoutMethod } from "@/lib/mollie";

interface Props {
  price: number;
  stock: number;
  deliveryTime: string | null;
  category: string;
  /** Live Mollie-methoden (zelfde chips als de footer); leeg → vaste iconen. */
  mollieMethods?: ReadonlyArray<CheckoutMethod>;
}

/**
 * Koopblok direct onder de koopknop: verzendkosten, levertijd, garantie en
 * betaalmethoden. Bewust zonder bedenktijd, telefoonnummer en showroom-regel
 * (op verzoek van de eigenaar, 2026-10-13); die staan in de footer en op
 * /retourneren. Alle waarden uit lib/shipping-info — nergens hardcoded.
 */
export function PurchaseInfo({ price, stock, deliveryTime, category, mollieMethods = [] }: Props) {
  const freeShipping = price >= shippingInfo.freeShippingThreshold;
  const inStock = stock > 0;
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
        {warrantyYears > 0 && (
          <li className={rowClass}>
            <ShieldCheck className={iconClass} strokeWidth={1.5} aria-hidden="true" />
            <span>{warrantyYears} jaar garantie op fabrieks- en materiaalfouten.</span>
          </li>
        )}
      </ul>
      {mollieMethods.length > 0 ? (
        <MolliePaymentChips methods={mollieMethods} tone="dark" className="mt-5" />
      ) : (
        <PaymentIconRow className="mt-5" />
      )}
    </div>
  );
}
