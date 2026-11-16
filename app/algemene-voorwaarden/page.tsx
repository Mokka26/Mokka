import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { TERMS_INTRO, TERMS_TITLE, termsSections } from "@/lib/terms";

// De tekst staat in lib/terms.ts (ook gebruikt als bijlage bij de
// orderbevestiging); art. 6 en 7 komen uit lib/shipping-info.ts.

export const metadata: Metadata = {
  title: "Algemene voorwaarden voor je bestelling",
  description:
    "De algemene voorwaarden van Mokka Home: identiteit van de onderneming, prijzen inclusief btw, levering, betaling, het herroepingsrecht en garantie.",
  alternates: { canonical: "/algemene-voorwaarden" },
};

const linkClass = "text-accent-dark underline underline-offset-2 hover:text-ink";

export default function VoorwaardenPage() {
  return (
    <LegalPage title={TERMS_TITLE} path="/algemene-voorwaarden" intro={TERMS_INTRO}>
      {termsSections().map((section) => (
        <LegalSection key={section.heading} heading={section.heading}>
          {section.paragraphs.map((p) => (
            <p key={p.text}>
              {p.text}
              {p.link ? (
                <>
                  {" "}
                  <Link href={p.link.href} className={linkClass}>
                    {p.link.label}
                  </Link>
                  .
                </>
              ) : null}
            </p>
          ))}
        </LegalSection>
      ))}
    </LegalPage>
  );
}
