"use client";

import { Truck, ShieldCheck, CreditCard, MessageCircle } from "lucide-react";
import { getUspsByKey } from "@/lib/shipping-info";

const ICONS = {
  shipping: Truck,
  warranty: ShieldCheck,
  payment: CreditCard,
  advice: MessageCircle,
} as const;

export default function TrustBar() {
  const items = getUspsByKey("shipping", "warranty", "payment", "advice");

  return (
    <section className="py-16 lg:py-20 bg-bone border-y border-line">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {items.map((item) => {
            const Icon = ICONS[item.key as keyof typeof ICONS] ?? Truck;
            return (
              <div key={item.key} className="flex flex-col items-center text-center">
                <div className="w-10 h-10 mb-4 flex items-center justify-center text-accent">
                  <Icon className="w-7 h-7" strokeWidth={1.25} />
                </div>
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-ink mb-2">
                  {item.title}
                </h4>
                <p className="text-xs text-stone leading-relaxed max-w-[200px]">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
