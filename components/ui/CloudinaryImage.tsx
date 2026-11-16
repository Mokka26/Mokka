"use client";

import Image, { type ImageProps } from "next/image";
import { cappedCloudinaryLoader, cloudinaryLoader } from "@/lib/cloudinary-url";

type Props = Omit<ImageProps, "loader"> & {
  /**
   * Plafond voor de gevraagde breedte (px). Voor sfeerbeelden onder de vouw:
   * op een telefoon met DPR 2,6 vraagt `sizes="100vw"` anders w_1440, terwijl
   * 1080 er op dat formaat niet zichtbaar slechter uitziet. Productfoto's
   * (PDP, galerij) laten dit leeg.
   */
  maxWidth?: number;
};

/**
 * next/image met de Cloudinary-loader, bruikbaar vanuit server components.
 *
 * Een `loader`-functie kan niet als prop van een server component naar het
 * client component `Image` worden gestuurd (niet serialiseerbaar). Deze
 * dunne client-wrapper zet de loader zelf, zodat ProductCard, Hero en de
 * homepage-secties server components kunnen blijven.
 */
export function CloudinaryImage({ alt, maxWidth, ...props }: Props) {
  const loader = maxWidth ? cappedCloudinaryLoader(maxWidth) : cloudinaryLoader;
  return <Image {...props} alt={alt} loader={loader} />;
}
