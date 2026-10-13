"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendNewsletterWelcome, sendMail, INFO_EMAIL } from "@/lib/email";
import { rateLimitIp } from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";

// "use server"-modules mogen alleen async functies exporteren; de pagina heeft
// dezelfde regex lokaal (48 hex-tekens = randomBytes(24)).
const CONFIRM_TOKEN_RE = /^[a-f0-9]{48}$/;

export type ConfirmOutcome = "confirmed" | "already" | "invalid" | "error";

/**
 * Double opt-in, stap 2 — altijd via POST (knop "Bevestig mijn aanmelding"),
 * nooit op GET: mailscanners en link-previews openen bevestigingslinks en
 * zouden anders iemand ongevraagd aanmelden.
 *
 * De update is conditioneel op het token (`where: { confirmToken }`): bij een
 * dubbele klik of twee gelijktijdige requests flipt maar één request de rij
 * (count === 1) en gaat er precies één welkomstmail uit.
 *
 * Redirect naar dezelfde pagina met `?done=<uitkomst>`; de pagina toont de
 * tekst. (Een server action met FormData werkt ook zonder JavaScript.)
 */
export async function confirmNewsletterSubscription(formData: FormData): Promise<void> {
  const outcome = await confirmByToken(formData.get("token"));
  redirect(`/nieuwsbrief/bevestigen?done=${outcome}`);
}

async function confirmByToken(raw: FormDataEntryValue | null): Promise<ConfirmOutcome> {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!CONFIRM_TOKEN_RE.test(token)) return "invalid";

  const rl = await rateLimitIp("newsletter-confirm", 10, 10 * 60 * 1000);
  if (!rl.ok) return "error";

  try {
    const sub = await prisma.newsletterSubscriber.findUnique({ where: { confirmToken: token } });
    if (!sub) return "invalid";
    if (sub.confirmedAt && !sub.unsubscribedAt) return "already";

    // Token is eenmalig: conditioneel op het token wissen → bij een race wint
    // precies één request.
    const flipped = await prisma.newsletterSubscriber.updateMany({
      where: { email: sub.email, confirmToken: token },
      data: { confirmedAt: new Date(), unsubscribedAt: null, confirmToken: null, confirmTokenAt: null },
    });
    if (flipped.count !== 1) return "already";

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
