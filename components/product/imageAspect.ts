import type { ProductImage } from "@/lib/imageHelpers";

/**
 * Beeldverhouding uit de echte foto (w/h uit het images-JSON) vertaald naar
 * een vaste set Tailwind-klassen, zodat liggende foto's (banken) niet in een
 * vierkant worden gecropt en staande foto's (lampen) niet worden afgesneden.
 */
export type Orientation = "landscape" | "portrait" | "square";

export function orientationOf(img: ProductImage | undefined): Orientation {
  if (!img?.w || !img?.h) return "square";
  const ratio = img.w / img.h;
  if (ratio >= 1.15) return "landscape";
  if (ratio <= 0.87) return "portrait";
  return "square";
}

/**
 * Galerij-frame op de productpagina: zelfde verhouding voor alle slides.
 * (De ProductCard gebruikt sinds de mobiele sweep één vaste 4:3-box met
 * object-contain, zodat rijen in een grid gelijk lopen.)
 */
export const GALLERY_ASPECT_CLASS: Record<Orientation, string> = {
  landscape: "aspect-[4/3]",
  portrait: "aspect-[4/5]",
  square: "aspect-square",
};
