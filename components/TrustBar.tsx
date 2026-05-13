"use client";

import { Truck, RotateCcw, ShieldCheck, MessageCircle } from "lucide-react";

interface Trust {
  icon: typeof Truck;
  title: string;
  description: string;
}

const items: Trust[] = [
  {
    icon: Truck,
    title: "Gratis verzending",
    description: "Bij bestellingen boven €100 binnen Nederland en België.",
  },
  {
    icon: RotateCcw,
    title: "30 dagen retour",
    description: "Niet tevreden? Retour zonder gedoe binnen 30 dagen.",
  },
  {
    icon: ShieldCheck,
    title: "Veilig betalen",
    description: "iDEAL, creditcard en Klarna — versleutelde verbinding.",
  },
  {
    icon: MessageCircle,
    title: "Persoonlijk advies",
    description: "Ons atelier in Den Haag staat klaar voor stijlvragen.",
  },
];

export default function TrustBar() {
  return (
    <section className="py-16 lg:py-20 bg-bone border-y border-line">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex flex-col items-center text-center">
                <div className="w-10 h-10 mb-4 flex items-center justify-center text-bronze">
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
