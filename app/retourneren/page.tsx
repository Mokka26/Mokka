import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress } from "@/lib/business-info";

export const metadata: Metadata = {
  title: `Retourneren & herroepingsrecht — ${businessInfo.name}`,
  description:
    "Lees hoe je je bestelling bij Mokka Home retourneert. Je hebt 14 dagen wettelijk herroepingsrecht, met duidelijke uitleg over voorwaarden, kosten en de procedure.",
  alternates: { canonical: "/retourneren" },
};

export default function RetourPage() {
  return (
    <LegalPage
      title="Retourneren"
      intro="Niet helemaal tevreden? Je hebt het wettelijke recht je aankoop binnen 14 dagen te herroepen. Hieronder lees je hoe dat werkt."
    >
      <LegalSection heading="Herroepingstermijn van 14 dagen">
        <p>
          Je hebt het recht je bestelling binnen 14 dagen na ontvangst zonder opgave van
          reden te herroepen. Je hebt daarna nog eens 14 dagen om het product terug te sturen.
        </p>
      </LegalSection>
      <LegalSection heading="Hoe meld je een retour aan">
        <p>
          Meld je retour aan via {businessInfo.contact.email}. Vermeld je bestelnummer en
          welke artikelen je wilt terugsturen. Je ontvangt dan instructies en het retouradres.
        </p>
      </LegalSection>
      <LegalSection heading="Staat van het product">
        <p>
          Tijdens de bedenktijd ga je zorgvuldig om met het product en de verpakking. Je mag
          het product uitpakken en beoordelen zoals in een winkel zou mogen. Bij waardevermindering
          door onnodig gebruik kunnen we kosten in rekening brengen.
        </p>
      </LegalSection>
      <LegalSection heading="Terugbetaling">
        <p>
          We betalen het volledige aankoopbedrag (inclusief de standaard verzendkosten van de
          heenzending) binnen 14 dagen na ontvangst van je retourmelding terug, mits het product
          retour is of je hebt aangetoond dat je het hebt teruggestuurd.
        </p>
      </LegalSection>
      <LegalSection heading="Uitzonderingen">
        <p>
          Op maat gemaakte of speciaal voor jou samengestelde artikelen zijn uitgesloten van het
          herroepingsrecht. Dit wordt bij het betreffende product vermeld.
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
