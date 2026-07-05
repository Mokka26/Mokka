"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(2, "Vul je naam in").max(80),
  email: z.string().trim().email("Ongeldig e-mailadres").max(120),
  subject: z.string().trim().max(60).optional(),
  message: z.string().trim().min(5, "Schrijf een bericht").max(2000),
});

export async function submitContact(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Controleer je gegevens" };

  const rl = await rateLimit(`contact:ip:${await clientIp()}`, 5, 10 * 60 * 1000);
  if (!rl.ok) return { ok: false, error: "Te veel berichten verstuurd. Probeer het later opnieuw." };

  try {
    await prisma.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject || null,
        message: parsed.data.message,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Er ging iets mis bij het versturen. Probeer het later opnieuw." };
  }
}
