"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────
// Update profile (name)
// ─────────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(2, "Minstens 2 tekens").max(100),
});

export type ProfileState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: { name?: string };
};

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };
  const userId = (session.user as { id?: string }).id;
  if (!userId) return { error: "Geen gebruikers-id" };

  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    const fieldErrors: ProfileState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "name";
      fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  try {
    await prisma.adminUser.update({
      where: { id: userId },
      data: { name: parsed.data.name },
    });
  } catch {
    return { error: "Opslaan mislukt" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Change password
// ─────────────────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    current: z.string().min(1, "Huidig wachtwoord vereist"),
    next: z.string().min(8, "Minstens 8 tekens"),
    confirm: z.string().min(1),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirm"],
  });

export type PasswordState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: { current?: string; next?: string; confirm?: string };
};

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };
  const userId = (session.user as { id?: string }).id;
  if (!userId) return { error: "Geen gebruikers-id" };

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const fieldErrors: PasswordState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "current" | "next" | "confirm";
      fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const ok = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!ok) {
    return { fieldErrors: { current: "Huidig wachtwoord klopt niet" } };
  }

  const newHash = await bcrypt.hash(parsed.data.next, 12);
  try {
    await prisma.adminUser.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  } catch {
    return { error: "Opslaan mislukt" };
  }

  return { ok: true };
}
