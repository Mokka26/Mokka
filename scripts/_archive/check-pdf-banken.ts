import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
config({ path: ".env.local" });
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

for (const slug of ["bastia-bank", "tobi-bank", "fortis-bank", "verona-bank", "malaga-bank"]) {
  try {
    const r = await cloudinary.api.resource(`mokka/banken/${slug}/hero`);
    console.log(`${slug.padEnd(15)}: ${r.secure_url} (${r.bytes} bytes)`);
  } catch (e) {
    console.log(`${slug}: NOT FOUND`);
  }
}
