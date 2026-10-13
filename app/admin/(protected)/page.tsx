import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/components/ui/price";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import { Package, ShoppingBag, EyeOff, ImageOff, Euro, MessageSquare, PackageCheck } from "lucide-react";
import { productListHref, productStatusWhere } from "./_lib/product-filters";
import { orderListHref } from "./_lib/order-filters";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export default async function AdminDashboard() {
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);

  const [paid30, orders30, toProcess, productTotal, hiddenCount, noPhotoCount, noPriceCount, outOfStock, messages7, recentOrders] =
    await Promise.all([
      // Gearchiveerde bestellingen (archivedAt) tellen nergens mee.
      prisma.order.aggregate({
        where: { archivedAt: null, status: "paid", createdAt: { gte: since30 } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { archivedAt: null, createdAt: { gte: since30 } } }),
      prisma.order.count({ where: { archivedAt: null, status: "paid", fulfillmentStatus: "pending" } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null, ...productStatusWhere("hidden") } }),
      prisma.product.count({ where: { deletedAt: null, ...productStatusWhere("no-photo") } }),
      prisma.product.count({ where: { deletedAt: null, ...productStatusWhere("no-price") } }),
      prisma.product.count({ where: { deletedAt: null, ...productStatusWhere("out-of-stock") } }),
      prisma.contactMessage.count({ where: { createdAt: { gte: since7 } } }),
      prisma.order.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, firstName: true, lastName: true },
      }),
    ]);

  return (
    <div>
      <header className="mb-10">
        <p className="eyebrow-lg mb-2">Overzicht</p>
        <h1 className="font-serif text-4xl text-ink leading-none">Dashboard</h1>
      </header>

      <h2 className="eyebrow-lg mb-3">Laatste 30 dagen</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Stat
          icon={<Euro className="w-5 h-5" aria-hidden="true" />}
          label="Omzet (betaald)"
          value={formatPrice(paid30._sum.total ?? 0)}
          href={orderListHref({ status: "paid", period: "30d" })}
        />
        <Stat
          icon={<ShoppingBag className="w-5 h-5" aria-hidden="true" />}
          label="Betaalde bestellingen"
          value={`${paid30._count._all}`}
          sub={`${orders30} totaal (incl. open/mislukt)`}
          href={orderListHref({ status: "paid", period: "30d" })}
        />
        <Stat
          icon={<PackageCheck className="w-5 h-5" aria-hidden="true" />}
          label="Te verwerken"
          value={`${toProcess}`}
          sub="betaald, nog niet in behandeling"
          href={orderListHref({ status: "paid", fulfillment: "pending", period: "all" })}
          highlight={toProcess > 0}
        />
      </div>

      <h2 className="eyebrow-lg mb-3">Catalogus</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <Stat icon={<Package className="w-5 h-5" aria-hidden="true" />} label="Producten" value={`${productTotal}`} href="/admin/products" />
        <Stat icon={<EyeOff className="w-5 h-5" aria-hidden="true" />} label="Verborgen" value={`${hiddenCount}`} href={productListHref({ status: "hidden" })} />
        <Stat icon={<Euro className="w-5 h-5" aria-hidden="true" />} label="Zonder prijs" value={`${noPriceCount}`} href={productListHref({ status: "no-price" })} highlight={noPriceCount > 0} />
        <Stat icon={<ImageOff className="w-5 h-5" aria-hidden="true" />} label="Zonder foto" value={`${noPhotoCount}`} href={productListHref({ status: "no-photo" })} highlight={noPhotoCount > 0} />
        <Stat icon={<Package className="w-5 h-5" aria-hidden="true" />} label="Uitverkocht" value={`${outOfStock}`} href={productListHref({ status: "out-of-stock" })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Recente bestellingen</h2>
            <Link href="/admin/orders" className="eyebrow-lg hover:text-accent min-h-11 inline-flex items-center">
              Alles bekijken
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="px-5 py-6 text-base text-stone">Nog geen bestellingen.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentOrders.map((o) => (
                <li key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/orders/${o.id}`} className="text-base text-ink hover:text-accent tabular-nums">
                      {o.orderNumber}
                    </Link>
                    <p className="text-sm text-stone truncate">
                      {o.firstName} {o.lastName} · {dt.format(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <OrderStatusBadge status={o.status} />
                    <span className="font-serif text-base text-ink tabular-nums">{formatPrice(o.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-line">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Berichten</h2>
            <Link href="/admin/messages" className="eyebrow-lg hover:text-accent min-h-11 inline-flex items-center">
              Naar berichten
            </Link>
          </div>
          <div className="px-5 py-6 flex items-center gap-4">
            <MessageSquare className="w-6 h-6 text-stone" aria-hidden="true" />
            <p className="text-base text-ink">
              <span className="font-serif text-3xl tabular-nums mr-2">{messages7}</span>
              contactbericht{messages7 === 1 ? "" : "en"} in de laatste 7 dagen
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  href,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block bg-white border p-5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors ${
        highlight ? "border-accent/40" : "border-line"
      }`}
    >
      <div className="flex items-center gap-3 text-stone mb-3">
        {icon}
        <span className="eyebrow-lg">{label}</span>
      </div>
      <p className={`font-serif text-3xl leading-none tabular-nums ${highlight ? "text-accent-dark" : "text-ink"}`}>{value}</p>
      {sub && <p className="text-sm text-stone mt-2">{sub}</p>}
    </Link>
  );
}
