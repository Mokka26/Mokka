import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress } from "@/lib/business-info";

export const metadata: Metadata = {
  title: `Retourneren & herroepingsrecht — ${businessInfo.name}`,
  description:
    "Je hebt 14 dagen wettelijk herroepingsrecht bij Mokka Home. Lees de voorwaarden: het product moet ongebruikt en in de originele, ongeopende verpakking retour. Inclusief procedure, kosten en retouradres.",
  alternates: { canonical: "/retourneren" },
};

export default function RetourPage() {
  return (
    <LegalPage
      title="Retourneren"
      intro="Je hebt het wettelijke recht je aankoop binnen 14 dagen te herroepen. Om te kunnen retourneren moet het product wel ongebruikt en in de originele, ongeopende verpakking zijn. Hieronder lees je precies hoe het werkt."
    >
      <LegalSection heading="Herroepingstermijn van 14 dagen">
        <p>
          Je hebt het recht je bestelling binnen 14 dagen na ontvangst zonder opgave van reden te
          herroepen. Meld je binnen die termijn aan; daarna heb je nog eens 14 dagen om het product
          daadwerkelijk terug te sturen.
        </p>
      </LegalSection>

      <LegalSection heading="Voorwaarde: ongebruikt en in de originele verpakking">
        <p>
          Retourneren kan alleen als het product <strong>ongebruikt</strong> is en in de{" "}
          <strong>originele, ongeopende en onbeschadigde verpakking</strong> zit. Meubels worden op maat
          verpakt om ze veilig te vervoeren; zodra de verpakking is geopend of het product is
          gemonteerd of gebruikt, kunnen we het niet meer als nieuw verkopen en is retour niet meer
          mogelijk.
        </p>
        <p>
          Twijfel je over je keuze? Neem dan eerst contact met ons op via {businessInfo.contact.email} —
          we denken graag met je mee vóórdat je de verpakking opent.
        </p>
      </LegalSection>

      <LegalSection heading="Hoe meld je een retour aan">
        <p>
          Meld je retour aan via {businessInfo.contact.email}. Vermeld je bestelnummer en welke
          artikelen je wilt terugsturen. Je ontvangt dan instructies en het retouradres.
        </p>
      </LegalSection>

      <LegalSection heading="Terugbetaling">
        <p>
          We betalen het volledige aankoopbedrag (inclusief de standaard verzendkosten van de
          heenzending) binnen 14 dagen na goedkeuring van de retour terug, via dezelfde
          betaalmethode. De kosten voor het terugzenden zijn voor eigen rekening, tenzij anders
          afgesproken.
        </p>
      </LegalSection>

      <LegalSection heading="Uitzonderingen">
        <p>
          Op maat gemaakte, speciaal bestelde of voor jou samengestelde artikelen (zoals bepaalde
          bedden en meubels op bestelling) zijn wettelijk uitgesloten van het herroepingsrecht. Dit
          wordt bij het betreffende product vermeld.
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
