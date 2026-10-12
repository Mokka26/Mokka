import Link from "next/link";
import type { Metadata } from "next";
import { getOrderForReturnPage, type ReturnOrderView } from "@/lib/order-sync";
import { prisma } from "@/lib/prisma";
import { rateLimitIp } from "@/lib/rate-limit";
import { maskEmail, NEXT_STEP_AFTER_PAYMENT } from "@/lib/email";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { formatPrice } from "@/components/ui/price";
import ClearCart from "./ClearCart";
import { PurchaseConversion } from "./PurchaseConversion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bestelling afgerond: bedankt voor je bestelling",
  robots: { index: false, follow: false },
};

const COPY: Record<string, { eyebrow: string; title: string; body: string; tone: "ok" | "wait" | "bad" }> = {
  paid: { eyebrow: "Bedankt", title: "Betaling geslaagd", body: `Je bestelling is bevestigd. ${NEXT_STEP_AFTER_PAYMENT}`, tone: "ok" },
  open: { eyebrow: "In behandeling", title: "Betaling wordt verwerkt", body: "We wachten op de bevestiging van je betaling. Dit kan een paar minuten duren — je ontvangt bericht zodra het rond is.", tone: "wait" },
  failed: { eyebrow: "Mislukt", title: "Betaling niet gelukt", body: "De betaling is niet voltooid. Er is niets afgeschreven. Probeer het opnieuw.", tone: "bad" },
  canceled: { eyebrow: "Geannuleerd", title: "Betaling geannuleerd", body: "Je hebt de betaling afgebroken. Je winkelwagen staat nog klaar.", tone: "bad" },
  expired: { eyebrow: "Verlopen", title: "Betaling verlopen", body: "De betaaltijd is verstreken. Probeer het opnieuw.", tone: "bad" },
};

const TOKEN_RE = /^[a-f0-9]{32}$/;
const ORDER_RE = /^MOK-[A-Z0-9-]{6,20}$/;

export default async function CheckoutDonePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; order?: string }>;
}) {
  const { t, order: orderParam } = await searchParams;

  // Het syncen triggert een Mollie-call: begrens het per IP (30/min) zodat de
  // bedankpagina niet als gratis Mollie-proxy misbruikt kan worden.
  const allowSync = (await rateLimitIp("afgerond-sync", 30, 60 * 1000)).ok;

  // Voorkeur: niet-raadbare token (?t=). Legacy ?order=MOK-… (redirect-URL's
  // van betalingen gestart vóór de token) blijft werken, maar toont dan
  // uitsluitend de status — geen naam, e-mail of bedrag.
  let order: ReturnOrderView | null = null;
  let trusted = false;
  if (t && TOKEN_RE.test(t)) {
    order = await getOrderForReturnPage({ publicToken: t }, { allowSync });
    trusted = order !== null;
  } else if (orderParam && ORDER_RE.test(orderParam.toUpperCase())) {
    order = await getOrderForReturnPage({ orderNumber: orderParam.toUpperCase() }, { allowSync });
  }

  const status = order?.status ?? "unknown";
  const copy = COPY[status] ?? {
    eyebrow: "Bestelling",
    title: "Bestelling niet gevonden",
    body: "We konden deze bestelling niet vinden. Klopt er iets niet? Neem gerust contact met ons op.",
    tone: "bad" as const,
  };

  // Google Ads new_customer-parameter: eerste betaalde bestelling op dit
  // e-mailadres = nieuwe klant. Best-effort — bij een DB-hapering liever geen
  // conversie-detail dan een kapotte bedankpagina.
  const priorPaidOrders =
    order && trusted && status === "paid"
      ? await prisma.order
          .count({ where: { email: order.email, status: "paid", orderNumber: { not: order.orderNumber } } })
          .catch(() => 0)
      : 0;

  const phoneLink = getPhoneLink();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
      {copy.tone === "ok" && <ClearCart />}
      {order && trusted && status === "paid" && (
        <PurchaseConversion
          orderNumber={order.orderNumber}
          value={order.total}
          newCustomer={priorPaidOrders === 0}
        />
      )}
      <div className="bg-white border border-line p-12 sm:p-20 text-center max-w-2xl w-full">
        <div className="w-16 h-16 border border-line rounded-full flex items-center justify-center mx-auto mb-10">
          {copy.tone === "ok" ? (
            <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M5 13l4 4L19 7" />
            </svg>
          ) : copy.tone === "wait" ? (
            <svg className="w-7 h-7 text-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <p className="eyebrow mb-6">{copy.eyebrow}</p>
        <h1 className="display-md text-ink mb-6">
          {trusted && status === "paid" ? `Bedankt, ${order!.firstName}` : copy.title}
        </h1>
        <p className="body-lg text-slate mb-2">{copy.body}</p>

        {order && (
          <p className="text-stone text-sm mb-4">
            Bestelnummer <span className="text-ink tabular-nums">{order.orderNumber}</span>
            {trusted && status === "paid" && <> · {formatPrice(order.total)}</>}
          </p>
        )}
        {trusted && status === "paid" && (
          <p className="text-stone text-sm mb-10">
            De bevestiging sturen we naar <span className="text-ink">{maskEmail(order!.email)}</span>.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
          {(copy.tone === "bad" || copy.tone === "wait") && (
            <Link href="/checkout" className="btn-primary">Opnieuw proberen</Link>
          )}
          <Link href="/products" className={copy.tone === "ok" ? "btn-primary" : "btn-link"}>
            Verder winkelen
          </Link>
        </div>

        {phoneLink && businessInfo.contact.phoneFormatted && (
          <p className="text-stone text-sm mt-10">
            Vragen? Bel ons op{" "}
            <a href={phoneLink} className="text-ink underline underline-offset-4">
              {businessInfo.contact.phoneFormatted}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
