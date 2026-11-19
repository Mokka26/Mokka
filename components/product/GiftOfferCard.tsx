import Image from "next/image";
import { Gift } from "lucide-react";
import type { GiftOffer } from "@/lib/campaign";

/** "a, b, c en d" */
function listNl(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

/**
 * Actieblok op de PDP: welk cadeau er bij dit product hoort en tot wanneer.
 * Bewust compact (één rij: foto + tekst), zodat de bestelknop niet onder de
 * vouw zakt. De server bepaalt of het geldt (lib/campaign giftFor); dit is
 * alleen weergave.
 */
export function GiftOfferCard({ gift }: { gift: GiftOffer }) {
  return (
    <section
      aria-labelledby="pdp-gift-title"
      className="mb-6 flex items-center gap-4 rounded-[12px] border border-line bg-bone p-3 pr-4"
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 overflow-hidden rounded-[8px] bg-paper">
        <Image src={gift.image.src} alt={gift.image.alt} fill sizes="96px" className="object-cover" />
      </div>
      <div className="min-w-0">
        <h2 id="pdp-gift-title" className="flex items-center gap-2 font-serif text-lg leading-snug text-ink">
          <Gift className="w-[18px] h-[18px] shrink-0 text-accent-dark" strokeWidth={1.5} aria-hidden />
          Gratis slaapset
        </h2>
        <p className="mt-1 text-base leading-snug text-graphite">
          {gift.name.replace(/ slaapset$/i, "")}: {listNl(gift.contents)}.
        </p>
        <p className="mt-1 text-base leading-snug font-medium text-accent-dark">Bij bestelling t/m {gift.untilLabel}</p>
      </div>
    </section>
  );
}
