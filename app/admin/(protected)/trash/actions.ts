"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { parseImages } from "@/lib/imageHelpers";
import { revalidateAllProducts, revalidateProduct } from "@/lib/revalidate";
import { logAdminError } from "../_lib/log";
import { parseAdminImages } from "../_lib/images";

type Result = { ok: true } | { ok: false; error: string };

const idSchema = z.object({ id: z.string().min(1) });

function isNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

/** Cloudinary-asset weggooien; een fout is niet blokkerend maar wordt wél gelogd. */
async function destroyAsset(publicId: string, context: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (e) {
    logAdminError(`${context}:cloudinary.destroy`, e, { publicId });
  }
}

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

  for (const img of parseImages(product.images)) {
    const pid = extractPublicId(img.url);
    if (pid) await destroyAsset(pid, "permanentlyDeleteProduct");
  }

  try {
    await prisma.product.delete({ where: { id: product.id } });
  } catch (e) {
    logAdminError("permanentlyDeleteProduct", e, { id: product.id });
    return { ok: false, error: "Definitief verwijderen mislukt. Probeer het opnieuw." };
  }

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
    // Public-ids die nog door een NIET-verwijderd product gebruikt worden →
    // nooit weggooien (gedeelde assets).
    const live = await prisma.product.findMany({ where: { deletedAt: null }, select: { images: true } });
    const liveIds = new Set<string>();
    for (const p of live) {
      for (const img of parseImages(p.images)) {
        const pid = extractPublicId(img.url);
        if (pid) liveIds.add(pid);
      }
    }

    const destroy = async (pid: string | null) => {
      if (!pid || liveIds.has(pid)) return;
      await destroyAsset(pid, "emptyTrash");
    };

    // 1) Verwijderde producten + hun foto's. Producten mét bestelgeschiedenis
    //    blijven soft-deleted (onDelete: Restrict beschermt de orderregels).
    const purgeWhere = { deletedAt: { not: null }, orderItems: { none: {} } } as const;
    const trashed = await prisma.product.findMany({ where: purgeWhere, select: { images: true } });
    for (const p of trashed) {
      for (const img of parseImages(p.images)) await destroy(extractPublicId(img.url));
    }
    const delProducts = await prisma.product.deleteMany({ where: purgeWhere });

    // 2) Losse verwijderde foto's (DeletedImage-tabel)
    const dImgs = await prisma.deletedImage.findMany({ select: { publicId: true } });
    for (const d of dImgs) await destroy(d.publicId);
    const delImages = await prisma.deletedImage.deleteMany({});

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

  await destroyAsset(di.publicId, "permanentlyDeleteImage");

  try {
    await prisma.deletedImage.delete({ where: { id: di.id } });
  } catch (e) {
    logAdminError("permanentlyDeleteImage", e, { id: di.id });
    return { ok: false, error: "Verwijderen mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/admin/trash");
  return { ok: true };
}
