import { NextRequest, NextResponse } from "next/server";
import { unsubscribeBySignedLink } from "@/lib/newsletter-unsubscribe-db";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * RFC 8058 one-click afmelden: de mailclient (Gmail, Apple Mail, Outlook)
 * POST naar de URL uit de List-Unsubscribe-header met de body
 * "List-Unsubscribe=One-Click". Het adres en de handtekening staan in de
 * query; de body wordt niet gebruikt. Ruimere limiet dan de pagina, omdat
 * mailproviders vanaf gedeelde IP's posten.
 */
export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outcome = await unsubscribeBySignedLink(sp.get("e"), sp.get("t"), {
    scope: "newsletter-unsubscribe-oneclick",
    limit: 30,
    headers: req.headers,
  });
  if (outcome === "invalid") {
    return new NextResponse("Ongeldige afmeldlink.", { status: 400, headers: NO_STORE });
  }
  if (outcome === "error") {
    return new NextResponse("Afmelden lukt nu niet. Probeer het later opnieuw.", { status: 503, headers: NO_STORE });
  }
  return new NextResponse("Je bent afgemeld voor de nieuwsbrief.", { status: 200, headers: NO_STORE });
}

/** Iemand opent de one-click-URL in de browser: naar de afmeldpagina (GET wijzigt niets). */
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const target = new URL("/nieuwsbrief/afmelden", req.nextUrl.origin);
  const e = sp.get("e");
  const t = sp.get("t");
  if (e) target.searchParams.set("e", e);
  if (t) target.searchParams.set("t", t);
  return NextResponse.redirect(target, { status: 303, headers: NO_STORE });
}
