// Vaste klassenamen voor animatie-volgorde. Tailwind ziet alleen letterlijke
// klassen in de broncode, dus geen `[--i:${n}]` maar een opzoeklijst.
// --i stuurt de vertraging van .hero-word en .reveal (zie globals.css).
const STAGGER = [
  "[--i:0]",
  "[--i:1]",
  "[--i:2]",
  "[--i:3]",
  "[--i:4]",
  "[--i:5]",
  "[--i:6]",
  "[--i:7]",
  "[--i:8]",
  "[--i:9]",
  "[--i:10]",
  "[--i:11]",
] as const;

export function stagger(i: number): string {
  return STAGGER[Math.min(Math.max(i, 0), STAGGER.length - 1)];
}
