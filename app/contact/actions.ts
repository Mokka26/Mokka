"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitIp } from "@/lib/rate-limit";
import { sendMail, INFO_EMAIL } from "@/lib/email";
import { captureError, captureWarning } from "@/lib/sentry";

// Geen regeleindes in velden die in een mail-header belanden (subject/naam):
// voorkomt header-injectie.
const noCrlf = (s: string) => !/[\r\n]/.test(s);

/**
 * Spam-bescherming zonder captcha (doelgroep 27-70: geen puzzels):
 *   - honeypot `website`: verborgen veld, moet leeg blijven → gevuld = bot;
 *   - `elapsedMs`: door de CLIENT gemeten tijd (performance.now() sinds mount)
 *     tussen tonen en versturen; onder 2,5 s is een bot. Bewust geen
 *     vergelijking met de serverklok: een afwijkende klantklok (het oude
 *     `startedAt`-epoch) liet echte berichten stil verdwijnen.
 *   - `startedAt` wordt nog geaccepteerd als legacy-veld maar is géén bron
 *     van waarheid meer.
 * Ontbreekt `elapsedMs`, dan loggen we dat als verdacht (captureWarning) maar
 * weigeren we niet. Een bot krijgt "ok" terug zonder opslag of mail — en dat
 * wordt altijd gelogd, nooit stil.
 */
const MIN_FILL_MS = 2500;

const schema = z.object({
  name: z.string().trim().min(2, "Vul je naam in").max(80).refine(noCrlf, "Ongeldige naam"),
  email: z.string().trim().email("Ongeldig e-mailadres").max(120),
  // Optioneel telefoonnummer: alleen cijfers, +, spaties en koppeltekens.
  // Lege string (leeg formulierveld) telt als "niet ingevuld".
  phone: z
    .string()
    .trim()
    .max(30, "Telefoonnummer is te lang")
    .regex(/^[0-9+\s-]*$/, "Ongeldig telefoonnummer")
    .optional()
    .transform((v) => (v ? v : undefined)),
  subject: z.string().trim().max(60).refine(noCrlf, "Ongeldig onderwerp").optional(),
  message: z.string().trim().min(5, "Schrijf een bericht").max(2000),
  website: z.string().max(200).optional(),
  elapsedMs: z.number().finite().nonnegative().optional(),
  startedAt: z.number().int().nonnegative().optional(),
});

type SpamSignals = { website?: string; elapsedMs?: number; startedAt?: number };

/** Reden waarom de inzending als bot geldt, of null als ze er menselijk uitziet. */
function botReason(input: SpamSignals): string | null {
  if (input.website && input.website.trim() !== "") return "honeypot";
  if (typeof input.elapsedMs === "number" && input.elapsedMs < MIN_FILL_MS) return "too-fast";
  return null;
}

export async function submitContact(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Controleer je gegevens" };

  // Bots krijgen een "ok" terug (geen signaal dat ze ontdekt zijn) — zonder
  // opslag of mail. Nooit stil: elke drop staat in Sentry.
  const reason = botReason(parsed.data);
  if (reason) {
    captureWarning("Contactformulier: inzending als bot genegeerd", { reason, elapsedMs: parsed.data.elapsedMs ?? null });
    return { ok: true };
  }
  if (parsed.data.elapsedMs === undefined) {
    captureWarning("Contactformulier: elapsedMs ontbreekt (verdacht, wel verwerkt)", {
      hasStartedAt: parsed.data.startedAt !== undefined,
    });
  }

  const rl = await rateLimitIp("contact", 5, 10 * 60 * 1000);
  if (!rl.ok) return { ok: false, error: "Te veel berichten verstuurd. Probeer het later opnieuw." };

  // ContactMessage heeft geen phone-kolom: het nummer gaat als eerste regel
  // mee in `message`, zodat het in de admin-inbox zichtbaar blijft.
  const phone = parsed.data.phone;
  const storedMessage = phone ? `Telefoon: ${phone}\n\n${parsed.data.message}` : parsed.data.message;

  try {
    await prisma.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject || null,
        message: storedMessage,
      },
    });
  } catch (e) {
    captureError(e, { scope: "submitContact" });
    return { ok: false, error: "Er ging iets mis bij het versturen. Probeer het later opnieuw." };
  }

  // Doorsturen naar info@ (best-effort — DB-opslag is al gelukt, dus de
  // inzending gaat nooit verloren als SMTP even hapert). replyTo = de klant,
  // zodat "Beantwoorden" in de mailbox direct naar de klant gaat.
  await sendMail({
    to: INFO_EMAIL,
    subject: `Contactformulier: ${parsed.data.subject || parsed.data.name}`,
    text: `Van: ${parsed.data.name} <${parsed.data.email}>\nTelefoon: ${phone || "—"}\nOnderwerp: ${parsed.data.subject || "—"}\n\n${parsed.data.message}`,
    replyTo: parsed.data.email,
  });
  return { ok: true };
}
