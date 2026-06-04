/**
 * Geeft alleen een veilig, intern (same-origin) pad terug voor post-login
 * redirects. Weert open-redirects: absolute URLs (http://…), protocol-relative
 * (//evil.com) en backslash-trucs (/\evil.com) vallen terug op de fallback.
 */
export function safeInternalPath(from: unknown, fallback = "/admin"): string {
  if (typeof from !== "string") return fallback;
  // Moet beginnen met één enkele "/" en geen "//" of "/\" zijn.
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) {
    return fallback;
  }
  return from;
}
