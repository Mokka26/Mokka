// Next.js 16: "middleware" is hernoemd naar "proxy".
import { NextResponse, type NextRequest } from "next/server";
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
// vereist een sessie). Alleen voor /admin: op publieke pagina's zou NextAuth
// anders bij elke (prefetch-)request sessie-cookies lezen én zetten voor
// anonieme bezoekers — onnodig werk en slechter voor de CDN-cache.
const adminProxy = auth(() => NextResponse.next());

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // NextAuth verwacht een route-context; de proxy heeft geen route-params.
  if (isAdminPath(pathname)) return adminProxy(req, { params: Promise.resolve({}) });
  const target = lowercaseTarget(pathname);
  if (!target) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = target;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Alles behalve API-routes, Next-internals en statische bestanden.
  // Let op de dubbele backslash: "\\." is een letterlijke punt in de regex.
  // Met een enkele "\." (= ".") werd élk pad van 2+ tekens uitgesloten en
  // draaide de proxy nergens.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
