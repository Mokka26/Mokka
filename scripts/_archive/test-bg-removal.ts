import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
config({ path: ".env.local" });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const r = await cloudinary.uploader.upload(
  "https://www.starlinemeubel.nl/assets/images/Banken/Tobi.jpeg",
  { public_id: "mokka/test/tobi-raw", overwrite: true },
);
console.log("uploaded:", r.secure_url, r.width, "x", r.height);

const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const variants = [
  ["e_background_removal", `https://res.cloudinary.com/${cloud}/image/upload/e_background_removal/mokka/test/tobi-raw.png`],
  ["e_bgremoval", `https://res.cloudinary.com/${cloud}/image/upload/e_bgremoval/mokka/test/tobi-raw.png`],
  ["e_background_removal:cloudinary_ai", `https://res.cloudinary.com/${cloud}/image/upload/e_background_removal:cloudinary_ai/mokka/test/tobi-raw.png`],
];

for (const [label, url] of variants) {
  const head = await fetch(url, { method: "HEAD" });
  console.log(`${label}: ${head.status} ${head.statusText}`);
}
