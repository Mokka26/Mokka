import { Truck, MessageCircle, ShieldCheck, CreditCard, type LucideIcon } from "lucide-react";
import { getUspsByKey } from "@/lib/shipping-info";

const ICONS: Record<string, LucideIcon> = {
  shipping: Truck,
  advice: MessageCircle,
  warranty: ShieldCheck,
  payment: CreditCard,
};

// Server component. USP-teksten komen uitsluitend uit lib/shipping-info.
// Direct onder de hero: de trust signals staan boven de fold mee.
export default function TrustBar() {
  // Geen retour-USP (bedenktijd staat alleen op /retourneren en in de voorwaarden).
  const items = getUspsByKey("shipping", "advice", "warranty", "payment");

  return (
    <section className="py-8 lg:py-10 bg-bone border-b border-line" aria-label="Onze service">
      <ul className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10">
        {items.map((item) => {
          const Icon = ICONS[item.key] ?? Truck;
          return (
            <li key={item.key} className="flex items-start gap-4">
              <span className="w-11 h-11 shrink-0 rounded-full bg-white text-accent-dark flex items-center justify-center" aria-hidden>
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </span>
              <div>
                <p className="text-base font-medium text-ink leading-snug">{item.title}</p>
                <p className="text-sm text-slate leading-[1.6] mt-0.5">{item.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
