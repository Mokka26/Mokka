"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const inlineUpdateSchema = z.object({
  id: z.string().min(1),
  price: z.number().nonnegative().max(999999).optional(),
  featured: z.boolean().optional(),
});

export type InlineUpdateInput = z.infer<typeof inlineUpdateSchema>;
export type InlineUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateProductInline(
  input: InlineUpdateInput,
): Promise<InlineUpdateResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = inlineUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { id, ...data } = parsed.data;
  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await prisma.product.update({ where: { id }, data });
  } catch {
    return { ok: false, error: "Update mislukt" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true };
}

const fullUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().nonnegative().max(999999),
  category: z.string().min(1).max(50),
  featured: z.boolean(),
});

export type FullUpdateState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof fullUpdateSchema>, string>>;
};

export async function updateProductFull(
  _prev: FullUpdateState,
  formData: FormData,
): Promise<FullUpdateState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };

  const parsed = fullUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: Number(formData.get("price")),
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: FullUpdateState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof fullUpdateSchema>;
      fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { id, ...data } = parsed.data;

  let updated;
  try {
    updated = await prisma.product.update({ where: { id }, data });
  } catch {
    return { error: "Update mislukt" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath(`/products/${updated.slug}`);
  return { ok: true };
}
