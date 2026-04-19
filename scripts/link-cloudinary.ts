/**
 * Koppel Cloudinary URLs aan producten in de database.
 *
 * De folder-slug (bijv. "armoni-sofa-set") heet anders dan de product-slug
 * ("armoni-bankstel"). Dit script maakt de koppeling op basis van productnaam.
 */

import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

// Mapping: product name (uit database) → folder slug (uit Cloudinary)
const mapping: Record<string, string> = {
  "Armoni Bankstel": "armoni-sofa-set",
  "Aspendos Hoekbank Goud": "aspendos-corner-set-gold",
  "Aspendos Bankstel Chroom": "aspendos-sofa-set-crom",
  "Aspendos Bankstel Goud": "aspendos-sofa-set-gold",
  "Belize Bankstel": "belize-sofa-set",
  "Belize Bankstel II": "belize-sofa-set-2",
  "Canyon Hoekbank": "canyon-corner-set",
  "Canyon Bankstel": "canyon-sofa-set",
  "Clara Bankstel": "clara-sofa-set",
  "Dior Bankstel Goud": "dior-sofa-set-gold",
  "Dior Bankstel Grijs": "dior-sofa-set-grey",
  "Elano Bankstel": "elano-sofa-set",
  "Jesse Bankstel": "jesse-sofa-set",
  "Jesse Bankstel Bruin": "jesse-sofa-set-brown",
  "Latte Bankstel": "latte-sofa-set",
  "Loris Bankstel Bruin": "loris-sofa-set-brown",
  "Loris Bankstel Crème": "loris-sofa-set-cream",
  "Lucas Bankstel Goud": "lucas-sofa-set-gold",
  "Milano Bankstel Bruin": "milano-sfoa-set-brown",
  "Milano Bankstel Grijs": "milano-sfoa-set-grey",
  "Mirage Bankstel Brons": "mirage-sofa-set-bronz",
  "Mirage Bankstel Goud": "mirage-sofa-set-gold",
  "Montel Bankstel": "montel-sofa-set",
  "Monza Bankstel Bruin": "monza-sofa-set-brown",
  "Monza Bankstel Crème": "monza-sofa-set-cream",
  "Moon Hoekbank": "moon-corner",
  "Nevada Bankstel": "nevada-sofa-set",
  "Odessa Hoekbank": "odessa-corner",
  "Odessa Bankstel Bruin": "odessa-sofa-set-brown",
  "Odessa Bankstel Goud": "odessa-sofa-set-gold",
  "Othello Hoekbank Goud": "othello-corner-set-gold",
  "Othello Bankstel Goud": "othello-sofa-set-gold",
  "Rixos Bankstel": "rixsos-sofa-set",
  "Rixos Bankstel II": "rixsos-sofa-set-2",
  "Romance Concept Set": "romance-concept-set",
  "Romeo Bankstel": "romeo-sofa-set",
  "Royal Hoekbank Goud": "royal-corner-set-gold",
  "Royal Bankstel Beige": "royal-sofa-set-bej",
  "Royal Bankstel Chroom": "royal-sofa-set-crom",
  "Teddy Hoekbank": "teddy-corner-set",
  "Tilda Bankstel Beige": "tilda-sofa-set-bej",
  "Tilda Bankstel Grijs": "tilda-sofa-set-grey",
};

async function link() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  let linked = 0;
  let missing = 0;

  for (const [productName, folderSlug] of Object.entries(mapping)) {
    try {
      // Vraag alle foto's op uit de Cloudinary folder
      const result = await cloudinary.api.resources({
        type: "upload",
        prefix: `mokka/banken/${folderSlug}/`,
        max_results: 100,
      });

      const urls = result.resources
        .map((r: any) => r.secure_url)
        .sort()
        .slice(0, 8);

      if (urls.length === 0) {
        console.log(`⚠ Geen foto's gevonden op Cloudinary voor: ${folderSlug}`);
        missing++;
        continue;
      }

      // Update product in DB
      const product = await prisma.product.findFirst({ where: { name: productName } });
      if (!product) {
        console.log(`⚠ Product niet in DB: ${productName}`);
        missing++;
        continue;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify(urls) },
      });

      console.log(`✓ ${productName} → ${urls.length} foto's`);
      linked++;
    } catch (err: any) {
      console.error(`❌ Fout bij ${productName}: ${err.message}`);
      missing++;
    }
  }

  console.log(`\n✅ ${linked} producten gekoppeld, ${missing} overgeslagen`);
  await prisma.$disconnect();
}

link().catch((e) => {
  console.error(e);
  process.exit(1);
});
