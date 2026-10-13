"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCategory } from "@/lib/categories";
import { revalidateAllProducts } from "@/lib/revalidate";
import { logAdminError } from "../_lib/log";

export type OrderResult = { ok: true } | { ok: false; error: string };

const orderSchema = z.object({
  slug: z.string().min(1),
  /** Product-id's in de gewenste volgorde (positie 1 = eerste in de lijst). */
  ids: z.array(z.string().min(1)).max(2000),
});

/**
 * Slaat de handmatige volgorde van een categorie op: positie 1..n in
 * `Product.sortOrder`. Alleen id's die écht in deze categorie zitten worden
 * geaccepteerd; de rest wordt genegeerd. Producten van de categorie die niet
 * in de lijst staan (bv. verborgen) houden hun huidige waarde.
 */
export async function saveCategoryOrder(input: { slug: string; ids: string[] }): Promise<OrderResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const category = getCategory(parsed.data.slug);
  if (!category) return { ok: false, error: "Categorie niet gevonden" };

  try {
    const valid = await prisma.product.findMany({
      where: { id: { in: parsed.data.ids }, category: { in: [...category.dbCategories] }, deletedAt: null },
      select: { id: true },
    });
    const allowed = new Set(valid.map((p) => p.id));
    const ordered = parsed.data.ids.filter((id) => allowed.has(id));

    await prisma.$transaction(
      ordered.map((id, index) => prisma.product.update({ where: { id }, data: { sortOrder: index + 1 } })),
    );
    revalidateAllProducts();
    return { ok: true };
  } catch (err) {
    logAdminError("saveCategoryOrder", err);
    return { ok: false, error: "Opslaan mislukt. Probeer het opnieuw." };
  }
}

/** Wist de handmatige volgorde van een categorie (terug naar favoriet + nieuwste). */
export async function clearCategoryOrder(slug: string): Promise<OrderResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const category = getCategory(slug);
  if (!category) return { ok: false, error: "Categorie niet gevonden" };

  try {
    await prisma.product.updateMany({
      where: { category: { in: [...category.dbCategories] }, deletedAt: null },
      data: { sortOrder: null },
    });
    revalidateAllProducts();
    return { ok: true };
  } catch (err) {
    logAdminError("clearCategoryOrder", err);
    return { ok: false, error: "Herstellen mislukt. Probeer het opnieuw." };
  }
}
