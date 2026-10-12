import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { csvResponse, isoDate, toCsv } from "@/app/admin/(protected)/_lib/csv";
import { subscriberStatus, subscriberWhere, parseSubscriberFilter } from "@/app/admin/(protected)/_lib/subscribers";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Amsterdam" });

/** CSV-export van nieuwsbriefabonnees; `?status=confirmed|unconfirmed|unsubscribed|all`. */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("Niet ingelogd", { status: 401 });

  const filter = parseSubscriberFilter(new URL(req.url).searchParams.get("status"));
  const rows = await prisma.newsletterSubscriber.findMany({
    where: subscriberWhere(filter),
    orderBy: { createdAt: "desc" },
    take: 50_000,
    select: { email: true, createdAt: true, confirmedAt: true, unsubscribedAt: true },
  });

  const csv = toCsv(
    ["E-mail", "Status", "Ingeschreven", "Bevestigd", "Afgemeld"],
    rows.map((r) => [
      r.email,
      subscriberStatus(r).label,
      dt.format(r.createdAt),
      r.confirmedAt ? dt.format(r.confirmedAt) : "",
      r.unsubscribedAt ? dt.format(r.unsubscribedAt) : "",
    ]),
  );

  return csvResponse(`nieuwsbrief-${filter}-${isoDate()}.csv`, csv);
}
