// Next.js 16: "middleware" is hernoemd naar "proxy".
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/** Publieke routes met hoofdletters (bv. /Banken) → 308 naar lowercase. */
function lowercaseTarget(pathname: string): string | null {
  if (!/[A-Z]/.test(pathname)) return null;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api") || pathname.startsWith("/_next")) return null;
  // Bestanden met extensie (icon.png, sitemap.xml, …) ongemoeid laten.
  if (/\.[A-Za-z0-9]+$/.test(pathname)) return null;
  return pathname.toLowerCase();
}

// `auth()` draait de `authorized`-callback uit auth.config.ts (alleen /admin
// vereist een sessie) en roept daarna onze handler aan.
export default auth((req) => {
  const target = lowercaseTarget(req.nextUrl.pathname);
  if (!target) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = target;
  return NextResponse.redirect(url, 308);
});

export const config = {
  // Alles behalve API-routes, Next-internals en statische bestanden.
  // Let op de dubbele backslash: "\\." is een letterlijke punt in de regex.
  // Met een enkele "\." (= ".") werd élk pad van 2+ tekens uitgesloten en
  // draaide de proxy nergens.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
