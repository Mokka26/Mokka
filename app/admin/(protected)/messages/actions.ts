"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAdminError } from "../_lib/log";

type Result = { ok: true } | { ok: false; error: string };

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteContactMessage(input: z.infer<typeof idSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  try {
    await prisma.contactMessage.delete({ where: { id: parsed.data.id } });
  } catch (e) {
    logAdminError("deleteContactMessage", e, { id: parsed.data.id });
    return { ok: false, error: "Verwijderen mislukt (bericht bestaat misschien al niet meer)" };
  }

  revalidatePath("/admin/messages");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

const emailSchema = z.object({ email: z.string().email() });

/** Abonnee definitief verwijderen (AVG-verzoek). */
export async function deleteSubscriber(input: z.infer<typeof emailSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig e-mailadres" };

  try {
    await prisma.newsletterSubscriber.delete({ where: { email: parsed.data.email } });
  } catch (e) {
    logAdminError("deleteSubscriber", e);
    return { ok: false, error: "Verwijderen mislukt (abonnee bestaat misschien al niet meer)" };
  }

  revalidatePath("/admin/messages");
  return { ok: true };
}
