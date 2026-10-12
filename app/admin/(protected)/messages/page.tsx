import Link from "next/link";
import { Download, Mail, Search, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/admin/Pagination";
import { StatusPill } from "@/components/admin/StatusBadge";
import DeleteButton from "./DeleteButtons";
import {
  SUBSCRIBER_FILTERS,
  SUBSCRIBER_FILTER_LABEL,
  parseSubscriberFilter,
  subscriberStatus,
  subscriberWhere,
} from "../_lib/subscribers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });

type Tab = "contact" | "nieuwsbrief";

function get(sp: Record<string, string | string[] | undefined>, k: string): string | undefined {
  const v = sp[k];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function href(p: { tab: Tab; q?: string; status?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (p.tab !== "contact") sp.set("tab", p.tab);
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const qs = sp.toString();
  return qs ? `/admin/messages?${qs}` : "/admin/messages";
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab: Tab = get(sp, "tab") === "nieuwsbrief" ? "nieuwsbrief" : "contact";
  const q = get(sp, "q")?.slice(0, 100);
  const status = parseSubscriberFilter(get(sp, "status"));
  const pageRaw = Number(get(sp, "page") ?? "1");
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const [contactTotal, confirmedCount, unconfirmedCount, unsubscribedCount] = await Promise.all([
    prisma.contactMessage.count(),
    prisma.newsletterSubscriber.count({ where: subscriberWhere("confirmed") }),
    prisma.newsletterSubscriber.count({ where: subscriberWhere("unconfirmed") }),
    prisma.newsletterSubscriber.count({ where: subscriberWhere("unsubscribed") }),
  ]);
  const subscriberTotal = confirmedCount + unconfirmedCount + unsubscribedCount;

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-2 min-h-11 px-4 text-[12px] uppercase tracking-[0.2em] border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
      active ? "border-ink text-ink" : "border-transparent text-stone hover:text-ink"
    }`;

  return (
    <div>
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2">Contact</p>
        <h1 className="font-serif text-4xl text-ink leading-none">Berichten</h1>
      </header>

      <nav aria-label="Berichten-tabs" className="flex items-center gap-2 mb-6 border-b border-line">
        <Link href={href({ tab: "contact" })} aria-current={tab === "contact" ? "page" : undefined} className={tabCls(tab === "contact")}>
          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
          Contactberichten <span className="opacity-60 tabular-nums">({contactTotal})</span>
        </Link>
        <Link
          href={href({ tab: "nieuwsbrief" })}
          aria-current={tab === "nieuwsbrief" ? "page" : undefined}
          className={tabCls(tab === "nieuwsbrief")}
        >
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          Nieuwsbrief <span className="opacity-60 tabular-nums">({subscriberTotal})</span>
        </Link>
      </nav>

      {tab === "contact" ? (
        <ContactTab q={q} page={page} />
      ) : (
        <NewsletterTab
          q={q}
          page={page}
          status={status}
          counts={{ confirmed: confirmedCount, unconfirmed: unconfirmedCount, unsubscribed: unsubscribedCount, all: subscriberTotal }}
        />
      )}
    </div>
  );
}

function SearchForm({ tab, q, status, placeholder }: { tab: Tab; q?: string; status?: string; placeholder: string }) {
  const id = `search-${tab}`;
  return (
    <form method="get" action="/admin/messages" className="flex flex-wrap items-end gap-3 mb-5">
      {tab !== "contact" && <input type="hidden" name="tab" value={tab} />}
      {status && status !== "all" && <input type="hidden" name="status" value={status} />}
      <div className="flex-1 min-w-[16rem]">
        <label htmlFor={id} className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5">
          Zoeken
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone pointer-events-none" />
          <input
            id={id}
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder={placeholder}
            className="w-full min-h-11 pl-10 pr-3 py-2.5 bg-white border border-line text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>
      <button
        type="submit"
        className="min-h-11 px-5 text-[11px] uppercase tracking-[0.25em] border border-ink text-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
      >
        Zoeken
      </button>
      {q && (
        <Link href={href({ tab, status })} className="inline-flex items-center min-h-11 px-3 text-[11px] uppercase tracking-[0.2em] text-stone hover:text-ink underline-offset-4 hover:underline">
          Wissen
        </Link>
      )}
    </form>
  );
}

async function ContactTab({ q, page }: { q?: string; page: number }) {
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { subject: { contains: q, mode: "insensitive" as const } },
          { message: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, messages] = await Promise.all([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <div>
      <SearchForm tab="contact" q={q} placeholder="Naam, e-mail, onderwerp of tekst" />

      {messages.length === 0 ? (
        <div className="bg-white border border-line p-12 text-center">
          <p className="font-serif text-2xl text-ink mb-2">{q ? "Niets gevonden" : "Nog geen berichten"}</p>
          <p className="text-base text-stone">
            {q ? "Probeer een andere zoekterm." : "Berichten via het contactformulier verschijnen hier."}
          </p>
        </div>
      ) : (
        <ul className="bg-white border border-line divide-y divide-line">
          {messages.map((m) => (
            <li key={m.id} className="px-4 sm:px-5 py-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/messages/${m.id}`}
                  className="block text-base text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-stone"> · {m.email}</span>
                </Link>
                <p className="text-base text-ink truncate mt-0.5">{m.subject || "(geen onderwerp)"}</p>
                <p className="text-sm text-stone line-clamp-2 mt-0.5">{m.message}</p>
                <p className="text-sm text-stone mt-1">{dt.format(m.createdAt)}</p>
              </div>
              <DeleteButton kind="message" id={m.id} label={`Bericht van ${m.name}`} />
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} label="berichten" hrefFor={(p) => href({ tab: "contact", q, page: p })} />
    </div>
  );
}

async function NewsletterTab({
  q,
  page,
  status,
  counts,
}: {
  q?: string;
  page: number;
  status: ReturnType<typeof parseSubscriberFilter>;
  counts: { all: number; confirmed: number; unconfirmed: number; unsubscribed: number };
}) {
  const where = {
    AND: [subscriberWhere(status), q ? { email: { contains: q, mode: "insensitive" as const } } : {}],
  };
  const [total, subscribers] = await Promise.all([
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { email: true, createdAt: true, confirmedAt: true, unsubscribedAt: true },
    }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <nav aria-label="Abonneestatus" className="flex flex-wrap items-center gap-2">
          {SUBSCRIBER_FILTERS.map((f) => (
            <Link
              key={f}
              href={href({ tab: "nieuwsbrief", status: f, q })}
              aria-current={status === f ? "page" : undefined}
              className={`inline-flex items-center min-h-11 px-3.5 text-[11px] uppercase tracking-[0.2em] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                status === f ? "bg-ink text-white border-ink" : "bg-white text-ink border-line hover:border-accent"
              }`}
            >
              {SUBSCRIBER_FILTER_LABEL[f]} <span className="opacity-60 ml-1.5 tabular-nums">{counts[f]}</span>
            </Link>
          ))}
        </nav>
        <a
          href={`/api/admin/newsletter/export${status !== "all" ? `?status=${status}` : ""}`}
          className="inline-flex items-center gap-2 min-h-11 px-4 text-[11px] uppercase tracking-[0.25em] border border-line text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Export CSV ({SUBSCRIBER_FILTER_LABEL[status].toLowerCase()})
        </a>
      </div>

      <SearchForm tab="nieuwsbrief" q={q} status={status} placeholder="E-mailadres" />

      {subscribers.length === 0 ? (
        <div className="bg-white border border-line p-12 text-center">
          <p className="font-serif text-2xl text-ink mb-2">Geen abonnees</p>
          <p className="text-base text-stone">Voor dit filter zijn er geen inschrijvingen.</p>
        </div>
      ) : (
        <ul className="bg-white border border-line divide-y divide-line">
          {subscribers.map((s) => {
            const st = subscriberStatus(s);
            return (
              <li key={s.email} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base text-ink truncate">{s.email}</p>
                  <p className="text-sm text-stone">
                    Ingeschreven {dt.format(s.createdAt)}
                    {s.confirmedAt ? ` · bevestigd ${dt.format(s.confirmedAt)}` : ""}
                    {s.unsubscribedAt ? ` · afgemeld ${dt.format(s.unsubscribedAt)}` : ""}
                  </p>
                </div>
                <StatusPill label={st.label} className={st.className} />
                <DeleteButton kind="subscriber" email={s.email} label={`Abonnee ${s.email}`} />
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        label="abonnees"
        hrefFor={(p) => href({ tab: "nieuwsbrief", status, q, page: p })}
      />
    </div>
  );
}
