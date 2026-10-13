import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress, getPhoneLink } from "@/lib/business-info";
import { shippingInfo, formatShippingCost } from "@/lib/shipping-info";
import { ogDefaults } from "@/lib/seo";

// Juridisch toetsen door de eigenaar: deze pagina volgt art. 6:230o-6:230s BW
// (herroepingsrecht bij koop op afstand). De teksten komen uit
// lib/shipping-info.ts; wijzig ze daar, niet hier.

const PATH = "/retourneren";
const TITLE = `Retourneren: ${shippingInfo.returnWindowDays} dagen bedenktijd en voorwaarden`;
const DESCRIPTION = `Je hebt ${shippingInfo.returnWindowDays} dagen wettelijke bedenktijd bij ${businessInfo.name}. Je mag het product bekijken en beoordelen; lees hoe je een retour aanmeldt, wat het kost en welke uitzonderingen gelden.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...ogDefaults({ title: `${TITLE} | ${businessInfo.name}`, description: DESCRIPTION, url: PATH }),
};

const linkClass = "text-accent-dark underline underline-offset-2 hover:text-ink";

export default function RetourPage() {
  const days = shippingInfo.returnWindowDays;
  const phoneLink = getPhoneLink();
  const { customMade } = shippingInfo;

  return (
    <LegalPage
      title="Retourneren"
      path="/retourneren"
      intro={`Je hebt het wettelijke recht je aankoop binnen ${days} dagen na ontvangst te herroepen, zonder opgave van reden. Je mag het product in die tijd uitpakken en beoordelen. Hieronder lees je hoe het werkt, wat het kost en welke uitzonderingen gelden.`}
    >
      <LegalSection heading="Tip: kom eerst proefzitten">
        <p>
          Een bank of bed retourneren is omslachtig — voor jou en voor ons. Twijfel je over maat, kleur of zitcomfort? Kom dan eerst langs in de showroom in {businessInfo.address.city}. Je ziet de materialen bij daglicht, zit op de modellen en we rekenen samen uit of het past.{" "}
          <Link href="/showroom" className={linkClass}>Bekijk de openingstijden</Link>.
        </p>
      </LegalSection>

      <LegalSection heading={`Bedenktijd van ${days} dagen`}>
        <p>
          Je mag je bestelling binnen {days} dagen na ontvangst zonder opgave van reden herroepen. Meld je retour binnen die termijn aan; daarna heb je nog eens {days} dagen om het product terug te sturen of terug te brengen.
        </p>
      </LegalSection>

      <LegalSection heading="Bekijken en beoordelen mag">
        <p>{shippingInfo.returnInspectionCopy}</p>
        <p>
          Bewaar de verpakking tot je zeker weet dat je het product houdt: dan kun je het bij een retour weer goed inpakken en komt het zonder transportschade terug. Twijfel je of iets onder normaal beoordelen valt, neem dan even contact met ons op.
        </p>
      </LegalSection>

      <LegalSection heading="Zo meld je een retour aan">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Mail naar{" "}
            <a href={`mailto:${businessInfo.contact.email}`} className={linkClass}>{businessInfo.contact.email}</a>
            {phoneLink && businessInfo.contact.phoneFormatted && (
              <>
                {" "}of bel{" "}
                <a href={phoneLink} className={linkClass}>{businessInfo.contact.phoneFormatted}</a>
              </>
            )}
            . Vermeld je bestelnummer en welke artikelen je wilt terugsturen.
          </li>
          <li>{shippingInfo.returnConfirmationCopy}</li>
          <li>Breng het product naar onze showroom, of stuur het goed verpakt op naar het retouradres hieronder. Voor grote meubels kunnen we het op afspraak ophalen; de kosten daarvan hoor je vooraf.</li>
          <li>Na ontvangst en controle betalen we binnen {days} dagen terug.</li>
        </ol>
      </LegalSection>

      <LegalSection heading="Kosten en terugbetaling">
        <p>
          We betalen het aankoopbedrag terug, inclusief de standaard verzendkosten van de heenzending ({formatShippingCost(shippingInfo.rates.standard)} onder de gratis-verzendgrens van €{shippingInfo.freeShippingThreshold}). Dat doen we binnen {days} dagen nadat we het product hebben ontvangen, via dezelfde betaalmethode als waarmee je betaald hebt.
        </p>
        <p>{shippingInfo.returnFeesCopy}</p>
        <p>
          Is het product gebruikt of beschadigd op een manier die verder gaat dan nodig om het te beoordelen, dan mogen we de waardevermindering verrekenen met het bedrag dat je terugkrijgt. We laten je dan vooraf weten om welk bedrag het gaat.
        </p>
      </LegalSection>

      <LegalSection heading="Uitzonderingen">
        <p>
          {customMade.label} is {customMade.definition}. {customMade.returnNote} Producten &ldquo;op bestelling&rdquo; (standaarduitvoering, besteld bij de fabrikant) zijn geen maatwerk en vallen gewoon onder de bedenktijd.
        </p>
      </LegalSection>

      <LegalSection heading="Retouradres">
        <p>
          {businessInfo.legalName}
          <br />
          {getFullAddress()}
        </p>
      </LegalSection>
    </LegalPage>
  );
}
