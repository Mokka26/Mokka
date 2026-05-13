import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
config({ path: ".env.local" });
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const r = await cloudinary.api.resource("mokka/banken/tobi-bank/hero");
console.log({
  url: r.secure_url,
  bytes: r.bytes,
  width: r.width,
  height: r.height,
  format: r.format,
  created: r.created_at,
});
