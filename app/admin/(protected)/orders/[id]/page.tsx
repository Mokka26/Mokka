import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/components/ui/price";
import { FulfillmentBadge, OrderStatusBadge, StatusPill } from "@/components/admin/StatusBadge";
import DeleteOrderButton from "../DeleteOrderButton";
import FulfillmentForm from "./FulfillmentForm";
import { orderListHref } from "../../_lib/order-filters";
import { countryLabel, paymentMethodLabel } from "../../_lib/order-status";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Amsterdam" });

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: { select: { slug: true, deletedAt: true } } } } },
  });
  if (!order) notFound();

  const subtotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);

  const timeline: { label: string; at: Date | null }[] = [
    { label: "Aangemaakt", at: order.createdAt },
    { label: "Betaald", at: order.paidAt },
    { label: "Bevestigingsmail verstuurd", at: order.confirmationSentAt },
    { label: "Verzonden", at: order.shippedAt },
  ];

  return (
    <div>
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 min-h-11 eyebrow-lg hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Terug naar bestellingen
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow-lg mb-2">Bestelling</p>
          <h1 className="font-serif text-4xl text-ink leading-none tabular-nums mb-3">{order.orderNumber}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <FulfillmentBadge status={order.fulfillmentStatus} />
            {order.archivedAt && <StatusPill label="Gearchiveerd" className="bg-stone/10 text-stone" />}
            <span className="text-sm text-stone">{dt.format(order.createdAt)}</span>
          </div>
        </div>
        {!order.archivedAt && (
          <DeleteOrderButton
            id={order.id}
            orderNumber={order.orderNumber}
            paid={order.status === "paid"}
            redirectTo="/admin/orders"
            variant="full"
          />
        )}
      </header>

      {order.archivedAt && (
        <p role="status" className="mb-8 bg-stone/10 border border-line px-5 py-4 text-base text-ink leading-relaxed">
          Deze bestelling is gearchiveerd op {dt.format(order.archivedAt)}. Ze staat niet meer in de gewone lijst en
          telt niet mee in het dashboard, maar blijft bewaard voor de administratie.{" "}
          <Link href={orderListHref({ archived: true })} className="underline underline-offset-4 hover:text-accent">
            Naar het archief
          </Link>
          .
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Artikelen */}
          <section className="bg-white border border-line">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-serif text-lg text-ink">Artikelen</h2>
            </div>
            <ul className="divide-y divide-line">
              {order.items.map((it) => (
                <li key={it.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base text-ink">
                      {it.quantity}× {it.productName || "Product"}
                    </p>
                    {it.variantLabel && <p className="text-sm text-stone">{it.variantLabel}</p>}
                    {it.product && !it.product.deletedAt ? (
                      <Link
                        href={`/admin/products/${it.product.slug}`}
                        className="text-sm text-stone underline underline-offset-4 hover:text-accent"
                      >
                        Product bekijken
                      </Link>
                    ) : (
                      <p className="text-sm text-stone">Product niet meer actief</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base text-ink tabular-nums">{formatPrice(it.price * it.quantity)}</p>
                    {it.quantity > 1 && <p className="text-sm text-stone tabular-nums">{formatPrice(it.price)} per stuk</p>}
                  </div>
                </li>
              ))}
            </ul>
            <dl className="px-5 py-4 border-t border-line space-y-1.5 text-base">
              <Row label="Subtotaal" value={formatPrice(subtotal)} />
              <Row label="Verzending" value={order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)} />
              <Row label="Totaal incl. btw" value={formatPrice(order.total)} strong />
            </dl>
          </section>

          {/* Afhandeling */}
          <section className="bg-white border border-line p-5">
            <h2 className="font-serif text-lg text-ink mb-1">Afhandeling</h2>
            <p className="text-sm text-stone mb-5">
              Zet de status op &ldquo;Verzonden&rdquo; om de klant automatisch een verzendbevestiging te sturen
              (met trackingcode als je die invult).
            </p>
            <FulfillmentForm
              order={{
                id: order.id,
                fulfillmentStatus: order.fulfillmentStatus,
                trackingCode: order.trackingCode,
                trackingUrl: order.trackingUrl,
                adminNote: order.adminNote,
                shippedAt: order.shippedAt ? order.shippedAt.toISOString() : null,
              }}
            />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-line p-5">
            <h2 className="eyebrow-lg mb-3">Klant</h2>
            <p className="text-base text-ink">
              {order.firstName} {order.lastName}
            </p>
            <p className="text-base">
              <a href={`mailto:${order.email}`} className="text-ink underline underline-offset-4 hover:text-accent break-all">
                {order.email}
              </a>
            </p>
            {order.phone && (
              <p className="text-base">
                <a href={`tel:${order.phone}`} className="text-ink underline underline-offset-4 hover:text-accent">
                  {order.phone}
                </a>
              </p>
            )}
          </section>

          <section className="bg-white border border-line p-5">
            <h2 className="eyebrow-lg mb-3">Bezorgadres</h2>
            <address className="not-italic text-base text-ink leading-relaxed">
              {order.firstName} {order.lastName}
              <br />
              {order.address} {order.houseNumber}
              <br />
              {order.zipCode} {order.city}
              <br />
              {countryLabel(order.country)}
            </address>
          </section>

          <section className="bg-white border border-line p-5">
            <h2 className="eyebrow-lg mb-3">Betaling</h2>
            <dl className="space-y-1.5 text-base">
              <Row label="Status" value={<OrderStatusBadge status={order.status} />} />
              <Row label="Methode" value={paymentMethodLabel(order.paymentMethod)} />
              <Row label="Mollie-id" value={<span className="font-mono text-sm break-all">{order.molliePaymentId ?? "—"}</span>} />
              {order.gclid && <Row label="Google Ads" value={<span className="text-sm">via advertentie</span>} />}
            </dl>
          </section>

          <section className="bg-white border border-line p-5">
            <h2 className="eyebrow-lg mb-3">Tijdlijn</h2>
            <ol className="space-y-2">
              {timeline.map((t) => (
                <li key={t.label} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-2 w-2 h-2 rounded-full shrink-0 ${t.at ? "bg-success" : "bg-line"}`}
                  />
                  <div>
                    <p className={`text-base ${t.at ? "text-ink" : "text-stone"}`}>{t.label}</p>
                    <p className="text-sm text-stone">{t.at ? dt.format(t.at) : "Nog niet"}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className={strong ? "text-ink font-medium" : "text-stone"}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "text-ink font-serif text-lg" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
