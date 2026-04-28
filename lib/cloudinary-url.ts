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
 * Standaard mode `blurred`: c_pad + b_blurred — past foto in zonder crop,
 * vult over-ruimte met wazige uitvergroting van foto-randen. Geen harde
 * overgang, foto loopt visueel door tot rand van tegel. Geen merkbare
 * lege ruimte ongeacht originele foto-achtergrond.
 *
 * Mode `pad`: c_pad + b_auto — vult padding met gedetecteerde edge-kleur.
 * Werkt mooi als foto en container dezelfde kleur hebben.
 *
 * Mode `fill`: c_fill + g_auto — crop't smart om subject heen. Tightste
 * vulling, kan kleine delen van het product wegsnijden.
 */
export function cldOptimize(
  url: string,
  options: { ar?: string; w?: number; mode?: "blurred" | "pad" | "fill" } = {},
): string {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  const mode = options.mode ?? "blurred";
  const parts: string[] = ["f_auto", "q_auto"];
  if (options.ar) {
    if (mode === "fill") {
      parts.push("c_fill", "g_auto", `ar_${options.ar}`);
    } else if (mode === "pad") {
      parts.push("c_pad", "b_auto", `ar_${options.ar}`);
    } else {
      parts.push("c_pad", "b_blurred:400:15", `ar_${options.ar}`);
    }
  }
  if (options.w) parts.push(`w_${options.w}`);

  const transform = parts.join(",");
  return url.replace("/upload/", `/upload/${transform}/`);
}
