// Preview Cloudinary transformation URLs voor Bolton Riviera hero.
// Run: tsx scripts/preview-hoekbank-transforms.ts
// Output: klikbare URLs (open in browser om te beoordelen).

const CLOUD = "diaksxzey";
const PUBLIC_ID = "mokka/hoekbanken/bolton-riviera-hoekbank/hero";

// Bone/paper background voor studio (uit globals.css)
const BONE = "EEEAE3";

// URL-encode prompt-tekst (spaces → %20) zodat de gen_background_replace URL klopt
const encodePrompt = (t: string) => t.replace(/prompt_([^/]+)/g, (_, p) => `prompt_${encodeURIComponent(p)}`);

const base = (transformations: string[]) =>
  `https://res.cloudinary.com/${CLOUD}/image/upload/${transformations.map(encodePrompt).join("/")}/${PUBLIC_ID}.png`;

// ─── STUDIO VARIANTEN ──────────────────────────────────────────────────────
console.log("─── STUDIO (hoofdfoto) ───────────────────────────────────────────");

console.log("\n[A] Solid bone + soft drop-shadow + 1600x1600 padded:");
console.log(base([
  "e_background_removal",
  "e_dropshadow:azimuth_215;elevation_45;spread_25",
  `b_rgb:${BONE}`,
  `c_pad,w_1600,h_1600`,
  "q_auto:best,f_auto",
]));

console.log("\n[B] Solid bone, geen shadow, strakker catalog-feel:");
console.log(base([
  "e_background_removal",
  `b_rgb:${BONE}`,
  `c_pad,w_1600,h_1600`,
  "q_auto:best,f_auto",
]));

console.log("\n[C] Bone + zwaardere shadow (meer 'floating' premium):");
console.log(base([
  "e_background_removal",
  "e_dropshadow:azimuth_180;elevation_60;spread_40",
  `b_rgb:${BONE}`,
  `c_pad,w_1600,h_1600`,
  "q_auto:best,f_auto",
]));

console.log("\n[D] Bone + AI upscale 2x (echte hi-res):");
console.log(base([
  "e_background_removal",
  "e_dropshadow:azimuth_215;elevation_45;spread_25",
  `b_rgb:${BONE}`,
  `c_pad,w_2400,h_2400`,
  "e_upscale",
  "q_auto:best,f_auto",
]));

// ─── LIFESTYLE / WOONKAMER VARIANTEN ───────────────────────────────────────
console.log("\n─── WOONKAMER (lifestyle) ────────────────────────────────────────");

console.log("\n[E] Wabi-sabi woonkamer, neutrale tinten:");
console.log(base([
  "e_background_removal",
  "e_gen_background_replace:prompt_minimalist wabi-sabi living room with light oak wood floor warm linen curtains soft natural daylight neutral plaster walls",
  `c_pad,w_1600,h_1600`,
  "q_auto:best,f_auto",
]));

console.log("\n[F] Editorial moderne woonkamer + terracotta accent (matcht site):");
console.log(base([
  "e_background_removal",
  "e_gen_background_replace:prompt_editorial premium living room warm bone walls oak parquet floor terracotta accent wall soft natural light minimal styling",
  `c_pad,w_1600,h_1600`,
  "q_auto:best,f_auto",
]));

console.log("\n[G] Loft-style met grote ramen:");
console.log(base([
  "e_background_removal",
  "e_gen_background_replace:prompt_modern loft living room large windows natural daylight concrete floor warm wood accents minimalist",
  `c_pad,w_1600,h_1600`,
  "q_auto:best,f_auto",
]));

console.log("\nKlik op een URL hierboven om in browser te bekijken.");
console.log("Eerste render duurt 5-15s (Cloudinary genereert on-demand), daarna gecached.");
