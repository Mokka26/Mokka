import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "Cookiebeleid: welke cookies we gebruiken",
  description:
    "Welke cookies en diensten Mokka Home gebruikt: wat nodig is voor de winkelwagen, en wat pas na je akkoord laadt: Google Analytics, Google Ads en Google Maps.",
  alternates: { canonical: "/cookies" },
};

// Feitelijke beschrijving van wat de site laadt (bron: components/Analytics.tsx,
// components/CookieBanner.tsx, components/home/ShowroomMap.tsx,
// app/checkout/afgerond/PurchaseConversion.tsx, instrumentation-client.ts).
// Wijzigt er iets aan tags of diensten, pas deze pagina dan mee aan.
// Juridisch toetsen door de eigenaar.

const listClass = "list-disc pl-5 space-y-2";

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookiebeleid"
      path="/cookies"
      intro="We gebruiken cookies en vergelijkbare technieken, zoals opslag in je browser. Een deel is nodig om de website te laten werken. Voor de rest vragen we eerst je toestemming. Hieronder lees je per dienst wat er gebeurt."
    >
      <LegalSection heading="Nodig om de website te laten werken">
        <p>Hiervoor is geen toestemming nodig. Deze gegevens blijven op je eigen apparaat of dienen alleen je bestelling.</p>
        <ul className={listClass}>
          <li>Je winkelwagen en de producten die je onlangs bekeek: opgeslagen in je browser (lokale opslag).</li>
          <li>Je keuze in de cookiemelding: opgeslagen in je browser.</li>
          <li>
            Na het betalen: een cookie (<code>mokka_order_t</code>, 24 uur geldig) waarmee de bedankpagina je
            bestelling kan tonen.
          </li>
          <li>Betalen gaat via Mollie. Op de betaalpagina van Mollie gelden hun eigen cookies.</li>
          <li>
            Vercel Speed Insights meet hoe snel de pagina&apos;s laden. Dat gebeurt zonder cookies en zonder
            dat je herkend wordt.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Alleen na je akkoord">
        <p>
          Kies je in de cookiemelding voor &ldquo;Accepteren&rdquo;, dan laden de diensten hieronder. Kies je
          &ldquo;Weigeren&rdquo;, dan laadt geen van deze diensten en gaat er niets naar Google of Sentry,
          tenzij je zelf op &ldquo;Kaart laden&rdquo; klikt (zie Google Maps).
          Eén keer &ldquo;Accepteren&rdquo; geldt voor al deze diensten samen; per dienst kiezen kan op dit
          moment niet.
        </p>
      </LegalSection>

      <LegalSection heading="Google Analytics (statistiek)">
        <p>
          We meten welke pagina&apos;s en producten bekeken worden en hoe vaak er besteld wordt, om de
          website te verbeteren. Google plaatst daarvoor cookies (<code>_ga</code> en <code>_ga_…</code>,
          tot 2 jaar geldig) met een willekeurige code waarmee je apparaat bij een volgend bezoek herkend
          wordt. We zien geen namen of e-mailadressen in deze statistieken.
        </p>
      </LegalSection>

      <LegalSection heading="Google Ads (advertenties)">
        <p>
          Google Ads plaatst cookies (zoals <code>_gcl_au</code> en <code>_gcl_aw</code>, tot 90 dagen
          geldig) waarmee we zien of een bezoek of bestelling volgt op een advertentie.
        </p>
        <p>
          Met je akkoord staat ook advertentiepersonalisatie aan. Google kan je bezoek dan gebruiken om je
          later advertenties van {businessInfo.name} te laten zien op andere websites en in diensten van
          Google (remarketing).
        </p>
        <p>
          Rond je een bestelling af, dan geven we na je akkoord ook je e-mailadres, telefoonnummer, naam
          en adres door aan Google, zodat Google de bestelling aan een advertentieklik kan koppelen
          (&ldquo;verbeterde conversies&rdquo;). Die gegevens worden in je browser eerst onherkenbaar
          gemaakt (gehasht) en pas daarna verstuurd.
        </p>
        <p>
          Kom je binnen via een advertentie van Google, dan staat er een klikcode in de link, die Google
          na je akkoord in een cookie bewaart. Bestel je daarna, dan slaan we die klikcode op bij je
          bestelling, zodat we achteraf kunnen nagaan welke advertentie tot een bestelling leidde.
        </p>
      </LegalSection>

      <LegalSection heading="Google Maps (kaart van de showroom)">
        <p>
          Op de homepage staat een kaart van onze showroom. Die kaart komt van Google Maps en laadt pas
          nadat je cookies hebt geaccepteerd of op &ldquo;Kaart laden&rdquo; klikt. Daarna kan Google cookies
          plaatsen en ziet Google je IP-adres. Tot die tijd zie je alleen een foto met het adres.
        </p>
      </LegalSection>

      <LegalSection heading="Foutmeldingen (Sentry)">
        <p>
          Na je akkoord stuurt je browser een melding naar Sentry als er op de website iets misgaat, zodat we
          de fout kunnen oplossen. Sentry plaatst daarvoor geen cookies en we nemen geen schermopnames op.
        </p>
      </LegalSection>

      <LegalSection heading="Je keuze beheren">
        <p>
          Je kunt weigeren zonder dat de website minder goed werkt. Je keuze wijzigen kan altijd via
          &ldquo;Cookie-instellingen&rdquo; onderaan elke pagina. Cookies die al geplaatst zijn, verwijder
          je via de instellingen van je browser.
        </p>
      </LegalSection>

      <LegalSection heading="Productfoto's en vragen">
        <p>
          Productfoto&apos;s laden we via Cloudinary; daarvoor gebruiken we geen cookies. Vragen over
          cookies kun je stellen via {businessInfo.contact.email}. Hoe we met je gegevens omgaan, lees je in
          de{" "}
          <Link href={businessInfo.legal.privacyPolicyUrl} className="text-accent-dark underline underline-offset-2 hover:text-ink">
            privacyverklaring
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
