import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress, getPhoneLink } from "@/lib/business-info";
import { shippingInfo, formatShippingCost } from "@/lib/shipping-info";

export const metadata: Metadata = {
  title: "Retourneren: 14 dagen bedenktijd en voorwaarden",
  description: `Je hebt ${shippingInfo.returnWindowDays} dagen wettelijk herroepingsrecht bij Mokka Home. Lees de voorwaarden (ongebruikt, originele verpakking), de stappen, de kosten en het retouradres.`,
  alternates: { canonical: "/retourneren" },
};

const linkClass = "text-accent-dark underline underline-offset-2 hover:text-ink";

export default function RetourPage() {
  const days = shippingInfo.returnWindowDays;
  const phoneLink = getPhoneLink();

  return (
    <LegalPage
      title="Retourneren"
      intro={`Je hebt het wettelijke recht je aankoop binnen ${days} dagen te herroepen. Voorwaarde: het product is ${shippingInfo.returnCondition}. Hieronder lees je precies hoe het werkt, wat het kost en hoe je het aanmeldt.`}
    >
      <LegalSection heading="Tip: kom eerst proefzitten">
        <p>
          Een bank of bed retourneren is omslachtig — voor jou en voor ons. Twijfel je over maat, kleur of zitcomfort? Kom dan eerst langs in de showroom in {businessInfo.address.city}. Je ziet de materialen bij daglicht, zit op de modellen en we rekenen samen uit of het past.{" "}
          <Link href="/contact" className={linkClass}>Bekijk de openingstijden</Link>.
        </p>
      </LegalSection>

      <LegalSection heading={`Herroepingstermijn van ${days} dagen`}>
        <p>
          Je mag je bestelling binnen {days} dagen na ontvangst zonder opgave van reden herroepen. Meld je retour binnen die termijn aan; daarna heb je nog eens {days} dagen om het product terug te sturen of terug te brengen.
        </p>
      </LegalSection>

      <LegalSection heading="Voorwaarde: ongebruikt en in de originele verpakking">
        <p>
          Retourneren kan alleen als het product <strong>ongebruikt</strong> is en in de{" "}
          <strong>originele, ongeopende en onbeschadigde verpakking</strong> zit. Meubels verpakken we op maat om ze veilig te vervoeren; zodra de verpakking open is of het product gemonteerd of gebruikt is, kunnen we het niet meer als nieuw verkopen en is retour niet meer mogelijk.
        </p>
        <p>
          Twijfel je of je het product gaat houden? Laat de verpakking dan dicht en neem eerst contact met ons op — we denken graag met je mee.
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
          <li>Je ontvangt binnen één werkdag een bevestiging met instructies.</li>
          <li>Breng het product (ongeopend) naar onze showroom, of stuur het op naar het retouradres hieronder. Voor grote meubels kunnen we het ophalen op afspraak; de kosten daarvan hoor je vooraf.</li>
          <li>Na ontvangst en controle betalen we binnen {days} dagen terug.</li>
        </ol>
      </LegalSection>

      <LegalSection heading="Kosten en terugbetaling">
        <p>
          We betalen het volledige aankoopbedrag terug, inclusief de standaard verzendkosten van de heenzending ({formatShippingCost(shippingInfo.rates.standard)} onder de gratis-verzendgrens van €{shippingInfo.freeShippingThreshold}). Dat doen we binnen {days} dagen na goedkeuring van de retour, via dezelfde betaalmethode als waarmee je betaald hebt.
        </p>
        <p>
          De kosten voor het terugsturen zijn voor jouw rekening, tenzij we iets anders afspreken. Terugbrengen naar de showroom is gratis.
        </p>
      </LegalSection>

      <LegalSection heading="Uitzonderingen">
        <p>
          Op maat gemaakte, speciaal bestelde of voor jou samengestelde artikelen (zoals bepaalde bedden en meubels op bestelling) zijn wettelijk uitgesloten van het herroepingsrecht. Dit staat bij het betreffende product vermeld vóórdat je bestelt.
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
