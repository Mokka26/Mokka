/**
 * Extract Cloudinary publicId from secure_url.
 *
 * Voorbeeld:
 *   https://res.cloudinary.com/diaksxzey/image/upload/v1234567/mokka/banken/anna-bank/copilot-1.jpg
 *   → "mokka/banken/anna-bank/copilot-1"
 *
 * Strip ook elke transformatie-segment ertussen.
 */
export function extractPublicId(url: string): string | null {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return null;
  const afterUpload = url.split("/upload/")[1];
  if (!afterUpload) return null;
  // afterUpload kan zijn: "v123/path/to/file.jpg" of "transforms/v123/path/file.jpg"
  const segments = afterUpload.split("/");
  // Pak het deel na de versie-segment (v<digits>)
  const versionIdx = segments.findIndex((s) => /^v\d+$/.test(s));
  const path =
    versionIdx >= 0 ? segments.slice(versionIdx + 1).join("/") : segments.join("/");
  // Strip extensie
  return path.replace(/\.(jpe?g|png|webp|avif|gif)$/i, "");
}
