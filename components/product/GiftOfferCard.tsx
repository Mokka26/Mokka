import Image from "next/image";
import { Check, Gift } from "lucide-react";
import type { GiftOffer } from "@/lib/campaign";

/**
 * Actieblok op de PDP: welk cadeau er bij dit product hoort en tot wanneer.
 * De server bepaalt of het geldt (lib/campaign giftFor); dit is alleen weergave.
 */
export function GiftOfferCard({ gift }: { gift: GiftOffer }) {
  return (
    <section
      aria-labelledby="pdp-gift-title"
      className="mb-6 flex gap-4 sm:gap-5 rounded-[14px] border border-line bg-bone p-4 sm:p-5"
    >
      <div className="relative w-24 sm:w-28 shrink-0 aspect-[2/3] overflow-hidden rounded-[8px] bg-paper">
        <Image src={gift.image.src} alt={gift.image.alt} fill sizes="112px" className="object-cover" />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-label text-accent-dark">
          <Gift className="w-4 h-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Black Friday · t/m {gift.untilLabel}
        </p>
        <h2 id="pdp-gift-title" className="mt-2 font-serif text-xl leading-snug text-ink">
          Gratis {gift.name}
        </h2>
        <ul className="mt-3 space-y-1.5">
          {gift.contents.map((item) => (
            <li key={item} className="flex items-start gap-2 text-base leading-snug text-ink">
              <Check className="mt-1 w-4 h-4 shrink-0 text-accent-dark" strokeWidth={2} aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-base leading-relaxed text-graphite">
          Bij elk bed dat je t/m {gift.untilLabel} bestelt. We leveren de set samen met je bed.
        </p>
      </div>
    </section>
  );
}
