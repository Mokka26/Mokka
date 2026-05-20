import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
config({ path: ".env.local" });
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

for (const slug of ["tobi-bank", "sanchez-bank", "memory-bank"]) {
  const r = await cloudinary.api.resource(`mokka/banken/${slug}/hero`);
  console.log(`${slug}: ${r.secure_url} (${r.bytes} bytes, ${r.width}x${r.height})`);
}
