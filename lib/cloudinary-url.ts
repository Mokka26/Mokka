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
  options: {
    ar?: string;
    w?: number;
    mode?: "pad" | "fill" | "thumb" | "contain";
    upscale?: boolean;
    /** Source-pixel-breedte uit DB; gebruikt om e_upscale veilig te kiezen. */
    sourceW?: number;
    dpr?: "auto" | number;
    quality?: "auto" | "auto:best" | "auto:good" | "auto:eco" | number;
  } = {},
): string {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  const mode = options.mode ?? "pad";
  const parts: string[] = [];
  // Cloudinary's e_upscale (AI-upscale) is een zware transform met meerdere
  // limieten die 400 Bad Request geven:
  //   1. source ≥ ~1500px werkt onbetrouwbaar (Cloudinary's AI faalt vaak)
  //   2. upscale-factor > 1.5x → 400
  //   3. downscale (source ≥ target) → 400
  //   4. zonder source-dims weten we niet of het veilig is
  // Conservatieve regel: alleen toepassen als source bekend, <1500px, en de
  // gevraagde upscale-factor binnen 1.0–1.5x ligt. Anders skip — Cloudinary
  // doet dan normale resize (browser scaled de rest).
  const UPSCALE_SOURCE_MAX = 1500;
  const canUpscale =
    options.upscale === true &&
    options.w !== undefined &&
    options.sourceW !== undefined &&
    options.sourceW < UPSCALE_SOURCE_MAX &&
    options.sourceW < options.w &&
    options.w / options.sourceW <= 1.5;
  if (canUpscale) parts.push("e_upscale");
  if (options.ar) {
    if (mode === "thumb") {
      parts.push("c_thumb", "g_auto", `ar_${options.ar}`);
    } else if (mode === "fill") {
      parts.push("c_fill", "g_auto", `ar_${options.ar}`);
    } else if (mode === "contain") {
      // c_pad + b_auto: hele foto in beeld (geen crop/zoom), opvulling in de
      // achtergrondkleur van de foto i.p.v. wit. Voor liggende lifestyle-foto's
      // (bv. Rousseau-tafels) die anders te ver inzoomen.
      parts.push("c_pad", "b_auto", `ar_${options.ar}`);
    } else {
      // c_pad met WITTE achtergrond: product volledig zichtbaar, geen crop.
      // b_white i.p.v. b_auto voorkomt gekleurde randen — product-foto's staan
      // op witte achtergrond, dus padding is naadloos onzichtbaar.
      parts.push("c_pad", "b_white", `ar_${options.ar}`);
    }
  }
  if (options.w) parts.push(`w_${options.w}`);
  if (options.dpr) parts.push(`dpr_${options.dpr}`);
  const q = options.quality ?? "auto";
  parts.push("f_auto", `q_${q}`);

  const transform = parts.join(",");
  return url.replace("/upload/", `/upload/${transform}/`);
}
