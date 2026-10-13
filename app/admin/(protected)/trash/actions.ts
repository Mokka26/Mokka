"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { collectReferencedCloudinaryIds, destroyCloudinaryAssets, publicIdsFromImages } from "@/lib/cloudinary-purge";
import { revalidateAllProducts, revalidateProduct } from "@/lib/revalidate";
import { logAdminError } from "../_lib/log";
import { parseAdminImages } from "../_lib/images";

type Result = { ok: true } | { ok: false; error: string };

const idSchema = z.object({ id: z.string().min(1) });

function isNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

// Cloudinary-assets gaan ALTIJD via lib/cloudinary-purge.ts: eerst de DB-rij
// weg, dan de assets, en nooit een asset die nog door een ander product
// (kleurvariant, herstelbaar prullenbak-item) wordt gebruikt.

// ─── Product: herstellen uit prullenbak ──────────────────────────────
export async function restoreProduct(input: z.infer<typeof idSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  let product: { slug: string; category: string };
  try {
    product = await prisma.product.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null },
      select: { slug: true, category: true },
    });
  } catch (e) {
    if (isNotFound(e)) return { ok: false, error: "Product niet gevonden" };
    logAdminError("restoreProduct", e, { id: parsed.data.id });
    return { ok: false, error: "Herstellen mislukt. Probeer het opnieuw." };
  }

  revalidateProduct(product);
  revalidatePath("/admin/trash");
  return { ok: true };
}

// ─── Product: definitief verwijderen + Cloudinary opruimen ───────────
export async function permanentlyDeleteProduct(input: z.infer<typeof idSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, images: true, deletedAt: true },
  });
  if (!product) return { ok: false, error: "Product niet gevonden" };
  if (!product.deletedAt) {
    return { ok: false, error: "Product staat niet in de prullenbak (verwijder het eerst)" };
  }
  // Bestelgeschiedenis beschermen (onDelete: Restrict) — niet hard verwijderen.
  const orderCount = await prisma.orderItem.count({ where: { productId: product.id } });
  if (orderCount > 0) {
    return {
      ok: false,
      error: "Product heeft bestelgeschiedenis en kan niet definitief verwijderd worden. Het blijft in de prullenbak.",
    };
  }

  try {
    await prisma.product.delete({ where: { id: product.id } });
  } catch (e) {
    if (isNotFound(e)) return { ok: false, error: "Product niet gevonden" };
    logAdminError("permanentlyDeleteProduct", e, { id: product.id });
    return { ok: false, error: "Definitief verwijderen mislukt. Probeer het opnieuw." };
  }

  // Rij is weg; nu de assets (gedeelde foto's van kleurvarianten blijven staan).
  await destroyCloudinaryAssets(publicIdsFromImages(product.images), { context: "permanentlyDeleteProduct" });

  revalidatePath("/admin/products");
  revalidatePath("/admin/trash");
  return { ok: true };
}

// ─── Foto: herstellen ────────────────────────────────────────────────
export async function restoreImage(input: z.infer<typeof idSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const di = await prisma.deletedImage.findUnique({ where: { id: parsed.data.id } });
  if (!di) return { ok: false, error: "Foto niet in prullenbak" };
  if (!di.productId) return { ok: false, error: "Bijbehorend product onbekend" };

  const product = await prisma.product.findUnique({
    where: { id: di.productId },
    select: { id: true, slug: true, category: true, images: true },
  });
  if (!product) return { ok: false, error: "Product niet meer aanwezig" };

  const imgs = parseAdminImages(product.images);
  if (imgs.some((i) => i.url === di.url)) {
    // Al aanwezig (bv. dubbel geklikt) → alleen de prullenbak-rij opruimen.
    try {
      await prisma.deletedImage.delete({ where: { id: di.id } });
    } catch (e) {
      logAdminError("restoreImage:cleanup", e, { id: di.id });
    }
    revalidatePath("/admin/trash");
    return { ok: true };
  }
  imgs.push({ url: di.url, w: di.w ?? undefined, h: di.h ?? undefined });

  try {
    await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: { images: JSON.stringify(imgs) } }),
      prisma.deletedImage.delete({ where: { id: di.id } }),
    ]);
  } catch (e) {
    logAdminError("restoreImage", e, { id: di.id, productId: product.id });
    return { ok: false, error: "Herstellen mislukt. Probeer het opnieuw." };
  }

  revalidateProduct(product);
  revalidatePath("/admin/trash");
  return { ok: true };
}

// ─── Hele prullenbak leegmaken (producten + losse foto's) ────────────
type EmptyResult = { ok: true; products: number; images: number } | { ok: false; error: string };

export async function emptyTrash(): Promise<EmptyResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  try {
    // 1) Verwijderde producten. Producten mét bestelgeschiedenis blijven
    //    soft-deleted (onDelete: Restrict beschermt de orderregels).
    const purgeWhere = { deletedAt: { not: null }, orderItems: { none: {} } } as const;
    const trashed = await prisma.product.findMany({ where: purgeWhere, select: { id: true, images: true } });
    const trashedIds = trashed.map((p) => p.id);
    const assetIds = trashed.flatMap((p) => publicIdsFromImages(p.images));

    // 2) Losse verwijderde foto's (DeletedImage-tabel)
    const dImgs = await prisma.deletedImage.findMany({ select: { publicId: true } });
    for (const d of dImgs) assetIds.push(d.publicId);

    // Eerst de rijen weg …
    const [delProducts, delImages] = await prisma.$transaction([
      prisma.product.deleteMany({ where: { id: { in: trashedIds } } }),
      prisma.deletedImage.deleteMany({}),
    ]);

    // … dan de assets, behalve wat een overgebleven product nog gebruikt.
    const referenced = await collectReferencedCloudinaryIds();
    await destroyCloudinaryAssets(assetIds, { context: "emptyTrash", referenced });

    revalidatePath("/admin/trash");
    revalidateAllProducts();
    return { ok: true, products: delProducts.count, images: delImages.count };
  } catch (e) {
    logAdminError("emptyTrash", e);
    return { ok: false, error: "Legen mislukt. Probeer het opnieuw." };
  }
}

// ─── Foto: definitief verwijderen (Cloudinary destroy) ───────────────
export async function permanentlyDeleteImage(input: z.infer<typeof idSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const di = await prisma.deletedImage.findUnique({ where: { id: parsed.data.id } });
  if (!di) return { ok: false, error: "Niet gevonden" };

  try {
    await prisma.deletedImage.delete({ where: { id: di.id } });
  } catch (e) {
    if (isNotFound(e)) return { ok: false, error: "Niet gevonden" };
    logAdminError("permanentlyDeleteImage", e, { id: di.id });
    return { ok: false, error: "Verwijderen mislukt. Probeer het opnieuw." };
  }

  // Rij is weg; asset alleen weg als geen product (bv. een kleurvariant) 'm nog gebruikt.
  await destroyCloudinaryAssets([di.publicId], { context: "permanentlyDeleteImage" });

  revalidatePath("/admin/trash");
  return { ok: true };
}
