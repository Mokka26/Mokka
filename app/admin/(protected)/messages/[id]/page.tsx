import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import DeleteButton from "../DeleteButtons";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Amsterdam" });

export default async function AdminMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) notFound();

  const subject = message.subject?.trim() || "(geen onderwerp)";
  const replySubject = encodeURIComponent(`Re: ${message.subject?.trim() || "je bericht aan Mokka Home"}`);

  return (
    <div>
      <Link
        href="/admin/messages"
        className="inline-flex items-center gap-1.5 min-h-11 eyebrow-lg hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Terug naar berichten
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow-lg mb-2">Contactbericht</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink leading-tight break-words">{subject}</h1>
          <p className="text-base text-stone mt-3">{dt.format(message.createdAt)}</p>
        </div>
        <DeleteButton kind="message" id={message.id} label={`Bericht van ${message.name}`} redirectTo="/admin/messages" variant="full" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border border-line p-5 sm:p-6">
          <h2 className="eyebrow-lg mb-3">Bericht</h2>
          <p className="text-base text-ink leading-relaxed whitespace-pre-wrap break-words">{message.message}</p>
        </section>

        <aside className="bg-white border border-line p-5 space-y-4">
          <div>
            <h2 className="eyebrow-lg mb-2">Afzender</h2>
            <p className="text-base text-ink">{message.name}</p>
            <a href={`mailto:${message.email}`} className="text-base text-ink underline underline-offset-4 hover:text-accent break-all">
              {message.email}
            </a>
          </div>
          <a
            href={`mailto:${message.email}?subject=${replySubject}`}
            className="inline-flex items-center justify-center w-full min-h-11 bg-ink text-white px-5 py-3 text-sm uppercase tracking-[0.1em] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
          >
            Beantwoorden per e-mail
          </a>
        </aside>
      </div>
    </div>
  );
}
