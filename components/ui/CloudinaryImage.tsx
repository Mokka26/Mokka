"use client";

import Image, { type ImageProps } from "next/image";
import { cloudinaryLoader } from "@/lib/cloudinary-url";

/**
 * next/image met de Cloudinary-loader, bruikbaar vanuit server components.
 *
 * Een `loader`-functie kan niet als prop van een server component naar het
 * client component `Image` worden gestuurd (niet serialiseerbaar). Deze
 * dunne client-wrapper zet de loader zelf, zodat ProductCard, Hero en de
 * homepage-secties server components kunnen blijven.
 */
export function CloudinaryImage({ alt, ...props }: Omit<ImageProps, "loader">) {
  return <Image {...props} alt={alt} loader={cloudinaryLoader} />;
}
