"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail, INFO_EMAIL } from "@/lib/email";

const emailSchema = z.string().trim().email("Ongeldig e-mailadres").max(120);

export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Vul een geldig e-mailadres in" };

  const rl = await rateLimit(`newsletter:ip:${await clientIp()}`, 5, 10 * 60 * 1000);
  if (!rl.ok) return { ok: false, error: "Te veel pogingen. Probeer het later opnieuw." };

  try {
    const addr = parsed.data.toLowerCase();
    // Alleen mailen bij een NIEUWE aanmelding (dubbele aanmelding = geen spam
    // naar info@). findUnique vóór de upsert bepaalt dat.
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: addr } });
    await prisma.newsletterSubscriber.upsert({ where: { email: addr }, create: { email: addr }, update: {} });
    if (!existing) {
      await sendMail({
        to: INFO_EMAIL,
        subject: "📬 Nieuwe nieuwsbrief-aanmelding",
        text: `Nieuwe aanmelding voor de nieuwsbrief: ${addr}`,
      });
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Er ging iets mis. Probeer het later opnieuw." };
  }
}
