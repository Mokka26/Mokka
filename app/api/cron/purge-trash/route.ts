// Auto-purge prullenbak items ouder dan RETENTION_DAYS.
//
// Beveiliging: uitsluitend `Authorization: Bearer <CRON_SECRET>` (zie
// lib/cron-auth.ts). Vercel Cron stuurt die header automatisch mee.
//
// Aanroepen:
//   POST /api/cron/purge-trash       (vanaf Vercel cron of handmatig met secret)
//
// Volgorde: eerst de DB-rijen weg, dán de Cloudinary-assets — en alleen assets
// die geen enkel ander product (kleurvariant, nog niet verlopen prullenbak-
// item) meer gebruikt (lib/cloudinary-purge.ts). Faalt een destroy, dan
// blijft hooguit een wees-asset staan (gelogd); de prullenbak is wel schoon.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";
import { captureError } from "@/lib/sentry";
import { collectReferencedCloudinaryIds, destroyCloudinaryAssets, publicIdsFromImages } from "@/lib/cloudinary-purge";

const RETENTION_DAYS = 30;
// Per run begrensd: één Cloudinary-destroy kost ~100-300 ms; binnen maxDuration blijven.
const MAX_PRODUCTS_PER_RUN = 100;
const MAX_IMAGES_PER_RUN = 200;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = {
    productsPurged: 0,
    productImagesDestroyed: 0,
    deletedImagesPurged: 0,
    assetsSkippedReferenced: 0,
    cloudinaryFailures: 0,
  };

  // ─── Producten in prullenbak >RETENTION_DAYS ───
  let expiredProducts: Array<{ id: string; slug: string; images: string }>;
  let expiredImages: Array<{ id: string; publicId: string }>;
  try {
    [expiredProducts, expiredImages] = await Promise.all([
      prisma.product.findMany({
        // Producten mét bestelgeschiedenis nooit hard-verwijderen (orderregels
        // beschermd via onDelete: Restrict) — ze blijven soft-deleted.
        where: { deletedAt: { lt: cutoff, not: null }, orderItems: { none: {} } },
        select: { id: true, slug: true, images: true },
        orderBy: { deletedAt: "asc" },
        take: MAX_PRODUCTS_PER_RUN,
      }),
      prisma.deletedImage.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true, publicId: true },
        orderBy: { deletedAt: "asc" },
        take: MAX_IMAGES_PER_RUN,
      }),
    ]);
  } catch (e) {
    captureError(e, { scope: "purgeTrash.query" });
    return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
  }

  // 1) Rijen verwijderen; assets van geslaagde verwijderingen verzamelen.
  const assetIds: string[] = [];
  const purgedProductIds: string[] = [];
  for (const p of expiredProducts) {
    try {
      await prisma.product.delete({ where: { id: p.id } });
      result.productsPurged += 1;
      purgedProductIds.push(p.id);
      assetIds.push(...publicIdsFromImages(p.images));
    } catch (e) {
      captureError(e, { scope: "purgeTrash.product", slug: p.slug });
    }
  }
  for (const di of expiredImages) {
    try {
      await prisma.deletedImage.delete({ where: { id: di.id } });
      result.deletedImagesPurged += 1;
      assetIds.push(di.publicId);
    } catch (e) {
      captureError(e, { scope: "purgeTrash.deletedImageRow", id: di.id });
    }
  }

  // 2) Assets opruimen — nooit die nog door een overgebleven product gebruikt worden.
  if (assetIds.length > 0) {
    let referenced: Set<string>;
    try {
      referenced = await collectReferencedCloudinaryIds(purgedProductIds);
    } catch (e) {
      captureError(e, { scope: "purgeTrash.referenced" });
      result.cloudinaryFailures += assetIds.length;
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }
    const purge = await destroyCloudinaryAssets(assetIds, { context: "purgeTrash", referenced });
    result.productImagesDestroyed = purge.destroyed;
    result.assetsSkippedReferenced = purge.skippedReferenced;
    result.cloudinaryFailures = purge.failed;
  }

  return NextResponse.json({ ok: true, ...result });
}

// Vercel-cron roept endpoints via GET aan → dezelfde (beveiligde) handler.
export const GET = POST;
