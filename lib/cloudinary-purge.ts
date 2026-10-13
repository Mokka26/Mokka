import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { parseImages } from "@/lib/imageHelpers";
import { captureError } from "@/lib/sentry";

/**
 * Cloudinary-assets definitief weggooien — met één harde regel: een asset die
 * nog door een ANDER product in de database wordt gebruikt (kleurvarianten
 * delen foto's; ook producten in de prullenbak kunnen hersteld worden) wordt
 * nooit vernietigd. Alle paden die assets opruimen (prullenbak-acties en de
 * purge-cron) gaan hierlangs, zodat de guard nergens vergeten kan worden.
 *
 * Volgorde is altijd: eerst de DB-rij weg, dán de assets. Mislukt een
 * destroy, dan blijft hooguit een wees-asset op Cloudinary staan (gelogd) —
 * nooit een DB-rij die naar een verdwenen foto wijst.
 */

export type PurgeResult = { destroyed: number; skippedReferenced: number; failed: number };

/** Unieke Cloudinary-public-ids uit een images-JSON (niet-Cloudinary-URL's overgeslagen). */
export function publicIdsFromImages(imagesJson: string | null | undefined): string[] {
  const ids = new Set<string>();
  for (const img of parseImages(imagesJson)) {
    const pid = extractPublicId(img.url);
    if (pid) ids.add(pid);
  }
  return [...ids];
}

/**
 * Alle public-ids die nog door een product in de database (zichtbaar,
 * verborgen óf in de prullenbak) gebruikt worden. `excludeProductIds` laat
 * producten weg die op het punt staan verwijderd te worden.
 */
export async function collectReferencedCloudinaryIds(excludeProductIds: ReadonlyArray<string> = []): Promise<Set<string>> {
  const products = await prisma.product.findMany({
    where: excludeProductIds.length > 0 ? { id: { notIn: [...excludeProductIds] } } : {},
    select: { images: true },
  });
  const referenced = new Set<string>();
  for (const p of products) for (const pid of publicIdsFromImages(p.images)) referenced.add(pid);
  return referenced;
}

/**
 * Vernietigt de opgegeven assets, behalve die nog ergens gebruikt worden.
 * Zonder `referenced` wordt de set zelf opgehaald (één query). Gooit nooit;
 * fouten per asset gaan naar Sentry met `context`.
 */
export async function destroyCloudinaryAssets(
  publicIds: Iterable<string>,
  opts: { context: string; referenced?: Set<string> },
): Promise<PurgeResult> {
  const result: PurgeResult = { destroyed: 0, skippedReferenced: 0, failed: 0 };
  const unique = [...new Set(publicIds)];
  if (unique.length === 0) return result;

  let referenced = opts.referenced;
  if (!referenced) {
    try {
      referenced = await collectReferencedCloudinaryIds();
    } catch (e) {
      // Zonder zekerheid over gedeeld gebruik niets vernietigen.
      captureError(e, { scope: `${opts.context}:cloudinary.referenced` });
      result.failed = unique.length;
      return result;
    }
  }

  for (const pid of unique) {
    if (referenced.has(pid)) {
      result.skippedReferenced += 1;
      continue;
    }
    try {
      await cloudinary.uploader.destroy(pid, { invalidate: true });
      result.destroyed += 1;
    } catch (e) {
      result.failed += 1;
      captureError(e, { scope: `${opts.context}:cloudinary.destroy`, publicId: pid });
    }
  }
  return result;
}
