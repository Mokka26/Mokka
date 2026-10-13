"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { sendNewsletterConfirmation } from "@/lib/email";
import { businessInfo } from "@/lib/business-info";
import { captureError, captureWarning } from "@/lib/sentry";

/**
 * Nieuwsbrief-aanmelding met double opt-in:
 *   1. aanmelding → confirmToken (+ confirmTokenAt) + bevestigingsmail met
 *      link naar /nieuwsbrief/bevestigen?token=…
 *   2. de klant klikt op die pagina op "Bevestig mijn aanmelding" (POST,
 *      app/nieuwsbrief/bevestigen/actions.ts) → confirmedAt gezet,
 *      welkomstmail + melding naar info@.
 * Niet-bevestigde aanmeldingen en verlopen tokens worden na 7 dagen
 * opgeruimd (cron/cleanup).
 *
 * Spam-bescherming: honeypot `website` (moet leeg zijn) en `elapsedMs`
 * (client-gemeten ms sinds het formulier verscheen; < 2,5 s = bot). Het
 * oude `startedAt`-epoch wordt nog geaccepteerd maar niet meer tegen de
 * serverklok gehouden. Ontbreekt `elapsedMs` → loggen, niet weigeren.
 * Compatibel: `subscribeNewsletter("mail@…")` blijft werken.
 */
const MIN_FILL_MS = 2500;

const inputSchema = z.object({
  email: z.string().trim().email("Ongeldig e-mailadres").max(120),
  website: z.string().max(200).optional(),
  elapsedMs: z.number().finite().nonnegative().optional(),
  startedAt: z.number().int().nonnegative().optional(),
});

export type NewsletterInput = string | z.input<typeof inputSchema>;

const GENERIC_ERROR = "Er ging iets mis. Probeer het later opnieuw.";

export async function subscribeNewsletter(input: NewsletterInput): Promise<{ ok: boolean; error?: string }> {
  const parsed = inputSchema.safeParse(typeof input === "string" ? { email: input } : input);
  if (!parsed.success) return { ok: false, error: "Vul een geldig e-mailadres in" };
  const { email, website, elapsedMs, startedAt } = parsed.data;

  // Bots krijgen "ok" (geen signaal), zonder opslag of mail — altijd gelogd.
  const botReason = website && website.trim() !== "" ? "honeypot" : typeof elapsedMs === "number" && elapsedMs < MIN_FILL_MS ? "too-fast" : null;
  if (botReason) {
    captureWarning("Nieuwsbrief: aanmelding als bot genegeerd", { reason: botReason, elapsedMs: elapsedMs ?? null });
    return { ok: true };
  }
  if (elapsedMs === undefined) {
    captureWarning("Nieuwsbrief: elapsedMs ontbreekt (verdacht, wel verwerkt)", { hasStartedAt: startedAt !== undefined });
  }

  const addr = email.toLowerCase();
  // Per IP én per adres: voorkomt dat iemand een ander adres bestookt met
  // bevestigingsmails.
  const [byIp, byEmail] = await Promise.all([
    rateLimitIp("newsletter", 5, 10 * 60 * 1000),
    rateLimit(`newsletter:email:${addr}`, 3, 60 * 60 * 1000),
  ]);
  if (!byIp.ok || !byEmail.ok) return { ok: false, error: "Te veel pogingen. Probeer het later opnieuw." };

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: addr } });
    // Al bevestigd en niet uitgeschreven → niets te doen (zelfde "ok" als een
    // nieuwe aanmelding, zodat het formulier niet verraadt wie er op de lijst staat).
    if (existing?.confirmedAt && !existing.unsubscribedAt) return { ok: true };

    const confirmToken = randomBytes(24).toString("hex");
    const confirmTokenAt = new Date();
    await prisma.newsletterSubscriber.upsert({
      where: { email: addr },
      create: { email: addr, confirmToken, confirmTokenAt },
      update: { confirmToken, confirmTokenAt },
    });

    const base = (process.env.NEXT_PUBLIC_BASE_URL || businessInfo.siteUrl).replace(/\/$/, "");
    const sent = await sendNewsletterConfirmation(addr, `${base}/nieuwsbrief/bevestigen?token=${confirmToken}`);
    if (!sent) return { ok: false, error: "We konden de bevestigingsmail niet versturen. Probeer het later opnieuw." };
    return { ok: true };
  } catch (e) {
    captureError(e, { scope: "subscribeNewsletter" });
    return { ok: false, error: GENERIC_ERROR };
  }
}
