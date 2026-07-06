// Auto-purge prullenbak items ouder dan RETENTION_DAYS.
//
// Beveiliging:
//   - Verwacht header `Authorization: Bearer <CRON_SECRET>` (Vercel cron + custom)
//   - Of `x-vercel-cron: 1` (Vercel cron jobs hebben dit)
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

const RETENTION_DAYS = 30;

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (auth && secret && auth === `Bearer ${secret}`) return true;
  // Vercel cron jobs add this header automatisch
  if (req.headers.get("x-vercel-cron") === "1" && secret) {
    // Vereis nog steeds dat CRON_SECRET is geconfigureerd
    return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
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
    where: { deletedAt: { lt: cutoff, not: null } },
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
          } catch {
            result.cloudinaryFailures += 1;
          }
        }
      }
    } catch {
      // images corrupt → sla over
    }

    try {
      await prisma.product.delete({ where: { id: p.id } });
      result.productsPurged += 1;
    } catch {
      // continue
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
    } catch {
      result.cloudinaryFailures += 1;
    }
    try {
      await prisma.deletedImage.delete({ where: { id: di.id } });
      result.deletedImagesPurged += 1;
    } catch {
      // continue
    }
  }

  return NextResponse.json({ ok: true, ...result });
}

// Vercel-cron roept endpoints via GET aan → dezelfde (beveiligde) handler.
export const GET = POST;
