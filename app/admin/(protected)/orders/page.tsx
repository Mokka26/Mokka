import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/components/ui/price";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Betaald", cls: "bg-green-100 text-green-800 border-green-200" },
  open: { label: "Open", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  failed: { label: "Mislukt", cls: "bg-red-100 text-red-800 border-red-200" },
  canceled: { label: "Geannuleerd", cls: "bg-stone/10 text-stone border-line" },
  expired: { label: "Verlopen", cls: "bg-stone/10 text-stone border-line" },
};

const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 200,
  });

  const paidCount = orders.filter((o) => o.status === "paid").length;
  const revenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.total, 0);

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-4xl text-ink leading-none mb-2">Bestellingen</h1>
        <p className="text-sm text-stone">
          {orders.length} bestelling{orders.length === 1 ? "" : "en"} · {paidCount} betaald · omzet {formatPrice(revenue)}
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="bg-white border border-line p-12 text-center">
          <p className="font-serif text-2xl text-ink mb-2">Nog geen bestellingen</p>
          <p className="text-sm text-stone">Zodra een klant afrekent verschijnt de bestelling hier.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const badge = STATUS[o.status] ?? { label: o.status, cls: "bg-stone/10 text-stone border-line" };
            return (
              <div key={o.id} className="bg-white border border-line p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-serif text-lg text-ink tabular-nums">{o.orderNumber}</span>
                      <span className={`text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 border rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-stone">{dt.format(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg text-ink tabular-nums">{formatPrice(o.total)}</p>
                    <p className="text-[11px] text-stone">incl. {formatPrice(o.shipping)} verzending</p>
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-stone mb-1.5">Klant</p>
                    <p className="text-ink">{o.firstName} {o.lastName}</p>
                    <p className="text-stone">{o.email}{o.phone ? ` · ${o.phone}` : ""}</p>
                    <p className="text-stone">{o.address} {o.houseNumber}, {o.zipCode} {o.city}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-stone mb-1.5">Artikelen</p>
                    <ul className="space-y-0.5">
                      {o.items.map((it) => (
                        <li key={it.id} className="text-ink flex justify-between gap-3">
                          <span>
                            {it.quantity}× {it.productName || "Product"}
                            {it.variantLabel ? <span className="text-stone"> · {it.variantLabel}</span> : null}
                          </span>
                          <span className="text-stone tabular-nums whitespace-nowrap">{formatPrice(it.price * it.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
