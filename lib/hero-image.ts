// Homepage-hero: woonkamer met het Tokyo Bankstel (AI-sfeerbeeld, foto 1 van
// het product). Zonder transformaties: components/Hero.tsx bouwt via
// cldOptimize + cloudinaryLoader twee responsive srcSets (mobiel 3:4,
// desktop 16:9) in één <picture>.
export const HERO_IMAGE_SOURCE =
  "https://res.cloudinary.com/diaksxzey/image/upload/v1793233810/mokka/bankstellen/tokyo-bankstel/sfeer-01.jpg";

export const HERO_IMAGE_ALT =
  "Lichte woonkamer met het Tokyo Bankstel in naturel stof, een ronde houten salontafel en een fauteuil";

/** Stille, naadloos herhalende sfeerclip (10 s, Kling 3.0 via Higgsfield,
 *  gemaakt van de 16:9-uitsnede van HERO_IMAGE_SOURCE — zelfde beeld, zodat
 *  de overgang foto → video onzichtbaar is). H.264, geen audio, faststart.
 *  Alleen vanaf md geladen, na de load van de pagina (zie HeroVideo). */
export const HERO_VIDEO = {
  large: "/video/hero-tokyo-1920.mp4", // 1920×1080, ±1,2 MB
  small: "/video/hero-tokyo-1280.mp4", // 1280×720, ±0,4 MB
} as const;

/** Product op de hero-foto. Prijs en link komen live uit de DB; is het
 *  product verborgen of verwijderd, dan valt het "Op de foto"-kaartje weg. */
export const HERO_PRODUCT_SLUG = "tokyo-bankstel";
