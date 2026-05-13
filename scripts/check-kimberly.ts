import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
config({ path: ".env.local" });
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const r = await cloudinary.api.resource(
  "mokka/eettafels/kimberly-ext-dt-160-200x90x75-black-veneer-plain/hero",
);
console.log(r.secure_url);
console.log(r.bytes, "bytes,", r.width, "x", r.height);
console.log("created:", r.created_at);
