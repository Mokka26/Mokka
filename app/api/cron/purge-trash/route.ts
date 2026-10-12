// Auto-purge prullenbak items ouder dan RETENTION_DAYS.
//
// Beveiliging: uitsluitend `Authorization: Bearer <CRON_SECRET>` (zie
// lib/cron-auth.ts). Vercel Cron stuurt die header automatisch mee.
//
// Aanroepen:
//   POST /api/cron/purge-trash       (vanaf Vercel cron of handmatig met secret)
//
// Cloudinary destroy gebeurt best-effort; faalt destroy, dan blijft asset op
// Cloudinary maar DB-record wordt wel verwijderd zodat de prullenbak schoon is.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { isCronAuthorized } from "@/lib/cron-auth";
import { captureError } from "@/lib/sentry";

const RETENTION_DAYS = 30;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = {
    productsPurged: 0,
    productImagesDestroyed: 0,
    deletedImagesPurged: 0,
    cloudinaryFailures: 0,
  };

  // ─── Producten in prullenbak >RETENTION_DAYS ───
  const expiredProducts = await prisma.product.findMany({
    // Producten mét bestelgeschiedenis nooit hard-verwijderen (orderregels
    // beschermd via onDelete: Restrict) — ze blijven soft-deleted.
    where: { deletedAt: { lt: cutoff, not: null }, orderItems: { none: {} } },
    select: { id: true, slug: true, images: true },
  });

  for (const p of expiredProducts) {
    // Destroy Cloudinary assets
    try {
      const raw = JSON.parse(p.images);
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const url = typeof item === "string" ? item : item?.url;
          const pid = url ? extractPublicId(url) : null;
          if (!pid) continue;
          try {
            await cloudinary.uploader.destroy(pid, { invalidate: true });
            result.productImagesDestroyed += 1;
          } catch (e) {
            result.cloudinaryFailures += 1;
            captureError(e, { scope: "purgeTrash.cloudinary", publicId: pid });
          }
        }
      }
    } catch {
      // images-JSON corrupt → geen assets te verwijderen; product zelf wel.
    }

    try {
      await prisma.product.delete({ where: { id: p.id } });
      result.productsPurged += 1;
    } catch (e) {
      captureError(e, { scope: "purgeTrash.product", slug: p.slug });
    }
  }

  // ─── DeletedImages >RETENTION_DAYS ───
  const expiredImages = await prisma.deletedImage.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, publicId: true },
  });

  for (const di of expiredImages) {
    try {
      await cloudinary.uploader.destroy(di.publicId, { invalidate: true });
    } catch (e) {
      result.cloudinaryFailures += 1;
      captureError(e, { scope: "purgeTrash.deletedImage", publicId: di.publicId });
    }
    try {
      await prisma.deletedImage.delete({ where: { id: di.id } });
      result.deletedImagesPurged += 1;
    } catch (e) {
      captureError(e, { scope: "purgeTrash.deletedImageRow", id: di.id });
    }
  }

  return NextResponse.json({ ok: true, ...result });
}

// Vercel-cron roept endpoints via GET aan → dezelfde (beveiligde) handler.
export const GET = POST;
