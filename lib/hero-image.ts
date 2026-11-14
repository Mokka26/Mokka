// Homepage-hero: woonkamer met het Tokyo Bankstel (AI-sfeerbeeld, foto 1 van
// het product). Zonder transformaties: components/Hero.tsx bouwt via
// cldOptimize + cloudinaryLoader twee responsive srcSets (mobiel 3:4,
// desktop 16:9) in één <picture>.
export const HERO_IMAGE_SOURCE =
  "https://res.cloudinary.com/diaksxzey/image/upload/v1793233810/mokka/bankstellen/tokyo-bankstel/sfeer-01.jpg";

export const HERO_IMAGE_ALT =
  "Lichte woonkamer met het Tokyo Bankstel in naturel stof, een ronde houten salontafel en een fauteuil";

/** Product op de hero-foto. Prijs en link komen live uit de DB; is het
 *  product verborgen of verwijderd, dan valt het "Op de foto"-kaartje weg. */
export const HERO_PRODUCT_SLUG = "tokyo-bankstel";
