import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

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
  } = {}
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const {
    width,
    height,
    quality = "auto",
    format = "auto",
    crop,
  } = options;

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
 * Met `ar` wordt c_fill+g_auto toegepast: Cloudinary herkent het onderwerp
 * (product) en crop't strak om het object heen — geen lege ruimte, product
 * altijd in beeld.
 */
export function cldOptimize(
  url: string,
  options: { ar?: string; w?: number } = {},
): string {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  const parts: string[] = ["f_auto", "q_auto"];
  if (options.ar) {
    parts.push("c_fill", "g_auto", `ar_${options.ar}`);
  }
  if (options.w) parts.push(`w_${options.w}`);

  const transform = parts.join(",");
  return url.replace("/upload/", `/upload/${transform}/`);
}
