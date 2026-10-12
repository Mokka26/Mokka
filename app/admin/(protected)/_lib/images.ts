import { parseImages, type ProductImage } from "@/lib/imageHelpers";

/**
 * Admin-variant van ProductImage met alt-tekst. `parseImages` (lib, niet van
 * de admin) kent `alt` nog niet; hier lezen we het veld apart uit de JSON
 * zodat het niet verloren gaat bij opnieuw opslaan.
 *
 * TODO(lib): `alt?: string` toevoegen aan ProductImage/parseImages in
 * lib/imageHelpers.ts, dan kan deze helper weg.
 */
export type AdminImage = ProductImage & { alt?: string };

export function parseAdminImages(raw: string | null | undefined): AdminImage[] {
  const base = parseImages(raw);
  if (base.length === 0 || !raw) return base;
  const altByUrl = new Map<string, string>();
  try {
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const url = (item as { url?: unknown }).url;
        const alt = (item as { alt?: unknown }).alt;
        if (typeof url === "string" && typeof alt === "string" && alt.trim()) altByUrl.set(url, alt.trim());
      }
    }
  } catch {
    return base;
  }
  return base.map((img) => {
    const alt = altByUrl.get(img.url);
    return alt ? { ...img, alt } : img;
  });
}
