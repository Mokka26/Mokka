/**
 * Pure URL helpers voor Cloudinary — geen SDK import.
 * Veilig om te importeren in client components.
 */

/**
 * Genereer een Cloudinary URL met transformaties.
 *
 * Voorbeeld:
 *   cldUrl("products/banken/armoni/1", { width: 800, quality: "auto" })
 *   → https://res.cloudinary.com/diaksxzey/image/upload/w_800,q_auto,f_auto/products/banken/armoni/1
 */
export function cldUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: "auto" | number;
    format?: "auto" | "webp" | "avif" | "jpg";
    crop?: "fill" | "fit" | "scale";
  } = {},
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const { width, height, quality = "auto", format = "auto", crop } = options;

  const parts: string[] = [];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (crop) parts.push(`c_${crop}`);
  parts.push(`q_${quality}`);
  parts.push(`f_${format}`);

  const transform = parts.join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${publicId}`;
}

/**
 * Voeg transformaties toe aan een bestaande Cloudinary URL.
 * Niet-Cloudinary URLs worden ongewijzigd teruggegeven.
 *
 * Mode `thumb`: c_thumb + g_auto — agressieve smart-crop die
 * inzoomt op het onderwerp. Product vult de tegel volledig,
 * geen padding. Beste voor productfoto's in tegels.
 *
 * Mode `pad` (default): c_pad + b_auto — vult padding met
 * gedetecteerde edge-kleur. Geen crop, maar kan zichtbare
 * padding-banden hebben.
 *
 * Mode `fill`: c_fill + g_auto — milde smart-crop, behoudt meer
 * context dan thumb.
 */
export function cldOptimize(
  url: string,
  options: { ar?: string; w?: number; mode?: "pad" | "fill" | "thumb" } = {},
): string {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  const mode = options.mode ?? "pad";
  const parts: string[] = [];
  if (options.ar) {
    if (mode === "thumb") {
      parts.push("c_thumb", "g_auto", `ar_${options.ar}`);
    } else if (mode === "fill") {
      parts.push("c_fill", "g_auto", `ar_${options.ar}`);
    } else {
      parts.push("c_pad", "b_auto", `ar_${options.ar}`);
    }
  }
  if (options.w) parts.push(`w_${options.w}`);
  parts.push("f_auto", "q_auto");

  const transform = parts.join(",");
  return url.replace("/upload/", `/upload/${transform}/`);
}
