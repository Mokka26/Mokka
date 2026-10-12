import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { sendNewsletterWelcome, sendMail, INFO_EMAIL } from "@/lib/email";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Aanmelding bevestigen — Mokka Home Interior",
  robots: { index: false, follow: false },
};

const TOKEN_RE = /^[a-f0-9]{48}$/;

type Outcome = "confirmed" | "already" | "invalid" | "error";

const COPY: Record<Outcome, { eyebrow: string; title: string; body: string }> = {
  confirmed: {
    eyebrow: "Welkom",
    title: "Je aanmelding is bevestigd",
    body: "Bedankt! Je ontvangt af en toe bericht over nieuwe collecties, showroomnieuws en aanbiedingen — niet vaker dan nodig.",
  },
  already: {
    eyebrow: "Nieuwsbrief",
    title: "Je staat al op de lijst",
    body: "Deze aanmelding was al bevestigd. Je hoeft verder niets te doen.",
  },
  invalid: {
    eyebrow: "Nieuwsbrief",
    title: "Deze link is niet (meer) geldig",
    body: "De bevestigingslink is verlopen of al gebruikt. Meld je gerust opnieuw aan via het formulier onderaan de pagina.",
  },
  error: {
    eyebrow: "Nieuwsbrief",
    title: "Er ging iets mis",
    body: "We konden je aanmelding nu niet bevestigen. Probeer het later opnieuw of neem contact met ons op.",
  },
};

async function confirm(token: string | undefined): Promise<Outcome> {
  if (!token || !TOKEN_RE.test(token)) return "invalid";
  try {
    const sub = await prisma.newsletterSubscriber.findUnique({ where: { confirmToken: token } });
    if (!sub) return "invalid";
    if (sub.confirmedAt && !sub.unsubscribedAt) return "already";

    // Token is eenmalig: na bevestiging wissen.
    await prisma.newsletterSubscriber.update({
      where: { email: sub.email },
      data: { confirmedAt: new Date(), unsubscribedAt: null, confirmToken: null },
    });

    // Welkomstmail + interne melding — best-effort, de bevestiging zelf staat al.
    await sendNewsletterWelcome(sub.email);
    await sendMail({
      to: INFO_EMAIL,
      subject: "Nieuwe nieuwsbrief-aanmelding (bevestigd)",
      text: `Bevestigde aanmelding voor de nieuwsbrief: ${sub.email}`,
    });
    return "confirmed";
  } catch (e) {
    captureError(e, { scope: "newsletterConfirm" });
    return "error";
  }
}

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const outcome = await confirm(token);
  const copy = COPY[outcome];
  const phoneLink = getPhoneLink();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
      <div className="bg-white border border-line p-12 sm:p-20 text-center max-w-2xl w-full">
        <p className="eyebrow mb-6">{copy.eyebrow}</p>
        <h1 className="display-md text-ink mb-6">{copy.title}</h1>
        <p className="body-lg text-slate mb-10">{copy.body}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/products" className="btn-primary">Bekijk de collectie</Link>
          <Link href="/" className="btn-link">Naar home</Link>
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
