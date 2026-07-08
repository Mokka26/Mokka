"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";

type Result = { ok: true } | { ok: false; error: string };

// ─── Product: restore from trash ─────────────────────────────────────
const idSchema = z.object({ id: z.string().min(1) });

export async function restoreProduct(input: z.infer<typeof idSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  try {
    await prisma.product.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null },
    });
  } catch {
    return { ok: false, error: "Herstellen mislukt" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/trash");
  revalidatePath("/products");
  return { ok: true };
}

// ─── Product: permanent delete + Cloudinary cleanup ──────────────────
export async function permanentlyDeleteProduct(
  input: z.infer<typeof idSchema>,
): Promise<Result> {
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
    return { ok: false, error: "Product staat niet in prullenbak (verwijder eerst)" };
  }

  // Destroy Cloudinary assets
  try {
    const raw = JSON.parse(product.images);
    if (Array.isArray(raw)) {
      const publicIds = raw
        .map((item) => extractPublicId(typeof item === "string" ? item : item.url))
        .filter((pid): pid is string => !!pid);
      for (const pid of publicIds) {
        try {
          await cloudinary.uploader.destroy(pid, { invalidate: true });
        } catch {
          // niet kritiek; product wordt sowieso verwijderd
        }
      }
    }
  } catch {
    // images JSON corrupt — sla over, doorga met DB-delete
  }

  try {
    await prisma.product.delete({ where: { id: parsed.data.id } });
  } catch {
    return { ok: false, error: "DB-delete mislukt" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/trash");
  return { ok: true };
}

// ─── Image: restore ─────────────────────────────────────────────────
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

  let imgs: { url: string; w?: number; h?: number }[] = [];
  try {
    const raw = JSON.parse(product.images);
    if (Array.isArray(raw)) {
      imgs = raw.map((item) =>
        typeof item === "string" ? { url: item } : { url: item.url, w: item.w, h: item.h },
      );
    }
  } catch {
    imgs = [];
  }

  // Voeg terug toe (achteraan)
  imgs.push({ url: di.url, w: di.w ?? undefined, h: di.h ?? undefined });

  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify(imgs) },
      }),
      prisma.deletedImage.delete({ where: { id: di.id } }),
    ]);
  } catch {
    return { ok: false, error: "Herstellen mislukt" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/trash");
  revalidatePath(`/products/${product.slug}`);
  revalidatePath(`/${product.category}`);
  revalidatePath(`/${product.category}/${product.slug}`);
  return { ok: true };
}

// ─── Hele prullenbak leegmaken (producten + losse foto's) ────────────
type EmptyResult = { ok: true; products: number; images: number } | { ok: false; error: string };

export async function emptyTrash(): Promise<EmptyResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  try {
    // Public-ids die nog door een NIET-verwijderd product gebruikt worden →
    // nooit slopen (gedeelde assets).
    const live = await prisma.product.findMany({ where: { deletedAt: null }, select: { images: true } });
    const liveIds = new Set<string>();
    for (const p of live) {
      try {
        for (const it of JSON.parse(p.images) as (string | { url: string })[]) {
          const pid = extractPublicId(typeof it === "string" ? it : it.url);
          if (pid) liveIds.add(pid);
        }
      } catch { /* corrupt json overslaan */ }
    }

    const destroy = async (pid: string | null) => {
      if (!pid || liveIds.has(pid)) return;
      try { await cloudinary.uploader.destroy(pid, { invalidate: true }); } catch { /* niet kritiek */ }
    };

    // 1) Verwijderde producten + hun foto's
    const trashed = await prisma.product.findMany({ where: { deletedAt: { not: null } }, select: { images: true } });
    for (const p of trashed) {
      try { for (const it of JSON.parse(p.images) as (string | { url: string })[]) await destroy(extractPublicId(typeof it === "string" ? it : it.url)); } catch { /* */ }
    }
    const delProducts = await prisma.product.deleteMany({ where: { deletedAt: { not: null } } });

    // 2) Losse verwijderde foto's (deletedImage-tabel)
    const dImgs = await prisma.deletedImage.findMany({ select: { publicId: true } });
    for (const d of dImgs) await destroy(d.publicId);
    const delImages = await prisma.deletedImage.deleteMany({});

    revalidatePath("/admin/trash");
    revalidatePath("/admin/products");
    return { ok: true, products: delProducts.count, images: delImages.count };
  } catch {
    return { ok: false, error: "Legen mislukt" };
  }
}

// ─── Image: permanent delete (Cloudinary destroy) ────────────────────
export async function permanentlyDeleteImage(
  input: z.infer<typeof idSchema>,
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const di = await prisma.deletedImage.findUnique({ where: { id: parsed.data.id } });
  if (!di) return { ok: false, error: "Niet gevonden" };

  try {
    await cloudinary.uploader.destroy(di.publicId, { invalidate: true });
  } catch {
    // Cloudinary kan al weg zijn; doorga
  }

  try {
    await prisma.deletedImage.delete({ where: { id: di.id } });
  } catch {
    return { ok: false, error: "DB-delete mislukt" };
  }

  revalidatePath("/admin/trash");
  return { ok: true };
}
