/**
 * Bron van waarheid voor alle product-categorieën.
 *
 * Wordt gebruikt voor:
 *  - Route-validatie (`app/[category]/page.tsx`)
 *  - Sitemap generatie
 *  - FilterBar groepering
 *  - ProductsContent labels + intros
 *  - JSON-LD CollectionPage schema
 *
 * Pseudo-categorieën (zoals "banken" = umbrella) zijn expliciet
 * gemarkeerd; ze hebben geen 1-op-1 mapping naar Product.category in DB.
 */

export type CategorySlug =
  | "banken"           // umbrella: hoekbanken + bankstellen
  | "hoekbanken"
  | "bankstellen"
  | "fauteuils"
  | "bedden"
  | "matrassen"
  | "slaapkamers"
  | "jeugdkamers"
  | "kasten"           // umbrella: kledingkasten + dressoirs + nachtkastjes + ladekasten + kapstokken
  | "kledingkasten"
  | "dressoirs"
  | "nachtkastjes"
  | "ladekasten"
  | "kapstokken"
  | "schoenenkasten"
  | "tafels"
  | "eettafels"
  | "salontafels"
  | "bijzettafels"
  | "tv-meubels"
  | "stoelen"           // umbrella: eetkamerstoelen + fauteuils
  | "eetkamerstoelen"
  | "poefs"
  | "spiegels"
  | "verlichting"      // umbrella: plafondlampen + vloerlampen + tafellampen + wandlampen
  | "plafondlampen"
  | "vloerlampen"
  | "tafellampen"
  | "wandlampen";

export type Category = {
  slug: CategorySlug;
  label: string;
  intro: string;
  /**
   * DB-mapping: welke `Product.category` waardes vallen onder deze slug.
   * Umbrella's mappen naar meerdere DB-categorieën.
   */
  dbCategories: ReadonlyArray<string>;
  /** True voor umbrella's die meerdere DB-categorieën combineren */
  isUmbrella: boolean;
  /** Hoort tot welke top-groep in FilterBar */
  group: "Banken" | "Tafels" | "Stoelen" | "Slapen" | "Opbergen" | "Sfeer";
  /**
   * Optioneel: gewenste display-volgorde van DB-sub-categorieën op een
   * umbrella-pagina. Producten van een hier genoemde categorie komen eerst,
   * in deze volgorde; niet-genoemde categorieën volgen daarna (in hun
   * featured/nieuwste-volgorde). Bv. banken → hoekbanken vóór bankstellen.
   */
  typeOrder?: ReadonlyArray<string>;
  /**
   * Optioneel: korte regel onder de productnaam op de kaart + PDP. Bv.
   * banken → "In diverse uitvoeringen en kleuren.". Per categorie gezet
   * zodat de tekst op één plek staat (geen hardcode in componenten).
   */
  cardSubtitle?: string;
  /**
   * Optioneel: korte, praktische tekst onder het productgrid (H2 "Over <label>").
   * Nuchter Nederlands, maten met context, geen claims. Ook de bron voor de
   * meta-description als `metaDescription` ontbreekt.
   */
  seoIntro?: string;
  /** Optioneel: eigen meta-description (140-160 tekens). */
  metaDescription?: string;
  /** Optioneel: 2-3 veelgestelde vragen, gerenderd als <details> + FAQPage-schema. */
  faq?: ReadonlyArray<{ q: string; a: string }>;
};

export const CATEGORIES: ReadonlyArray<Category> = [
  // ─── Banken ──────────────────────────────────────────────────
  {
    slug: "banken",
    label: "Alle banken",
    intro: "De volledige bank-collectie — hoekbanken en bankstellen samen op één plek.",
    dbCategories: ["banken", "hoekbanken", "bankstellen"],
    isUmbrella: true,
    group: "Banken",
    typeOrder: ["hoekbanken", "bankstellen"],
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
  },
  {
    slug: "hoekbanken",
    label: "Hoekbanken",
    intro: "De volledige collectie — losse banken, L- en U-vormige hoekbanken en lage loungebanken.",
    dbCategories: ["hoekbanken"],
    isUmbrella: false,
    group: "Banken",
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
    seoIntro:
      "Een hoekbank van 280 x 200 cm biedt plaats aan vier tot vijf personen en vraagt een woonkamer van minstens 4 x 4 m, met 80 cm loopruimte langs de open zijden en 40 tot 45 cm tot de salontafel. Let bij het kiezen op de richting van de hoek (links of rechts, gezien vanaf de voorkant) en op de zitdiepte: 55 tot 60 cm is normaal, 70 cm of meer is bedoeld om half liggend te zitten. Meet ook je voordeur en trap: de losse delen zijn meestal 90 tot 100 cm diep.",
    metaDescription:
      "Hoekbanken in L- en U-vorm, van 250 tot 350 cm breed. Een hoekbank van 280 x 200 cm biedt plaats aan 4 tot 5 personen en vraagt een kamer van minstens 4 x 4 m.",
    faq: [
      {
        q: "Hoe weet ik of ik een linkse of rechtse hoekbank nodig heb?",
        a: "Ga voor de bank staan en kijk ernaar. Zit het lange deel (de chaise longue of het hoekdeel) aan je linkerhand, dan is het een linkse uitvoering. Bij de productfoto's en specificaties staat welke richting je bestelt.",
      },
      {
        q: "Past een hoekbank door mijn deur?",
        a: "Hoekbanken worden in losse delen geleverd. Het grootste deel is meestal 90 tot 100 cm diep en 70 tot 90 cm hoog, en past zo door een standaard deur van 83 cm breed. De exacte maten per deel staan bij de specificaties.",
      },
      {
        q: "Welke zitdiepte is prettig?",
        a: "55 tot 60 cm zit rechtop en is prettig bij een televisieavond. 70 cm of meer is een loungediepte: je zit half liggend, met extra kussens in de rug.",
      },
    ],
  },
  {
    slug: "bankstellen",
    label: "Bankstellen",
    intro: "Complete zitcombinaties in 3+2+1 of 3+2 opstelling, in dezelfde stof en kleur.",
    dbCategories: ["bankstellen"],
    isUmbrella: false,
    group: "Banken",
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
    seoIntro:
      "Een bankstel is een set van twee of drie losse banken in dezelfde stof: een 3+2 of 3+2+1 opstelling. Een driezitsbank is 200 tot 230 cm breed, een tweezits 150 tot 180 cm. Zet je ze in een hoek tegenover elkaar, reken dan op een woonkamer van minstens 4 x 4 m met 80 cm loopruimte tussen de banken en de salontafel. Een bankstel is flexibeler dan een hoekbank: je kunt de losse delen later anders neerzetten of verhuizen door een smalle deur.",
    metaDescription:
      "Bankstellen in 3+2 en 3+2+1 opstelling, in stof of leer. Een driezits is 200-230 cm breed; tegenover elkaar vragen de banken een kamer van minstens 4 x 4 m.",
    faq: [
      {
        q: "Wat is het verschil tussen een bankstel en een hoekbank?",
        a: "Een bankstel bestaat uit losse banken (bijvoorbeeld een driezits en een tweezits) die je vrij kunt neerzetten. Een hoekbank is één aaneengesloten meubel in L- of U-vorm en biedt meer zitplaatsen op dezelfde oppervlakte.",
      },
      {
        q: "Hoeveel ruimte heb ik nodig voor een 3+2 bankstel?",
        a: "Reken op minstens 4 x 4 m als de banken in een hoek staan. Tussen bank en salontafel houd je 40 tot 45 cm, voor looproutes langs de banken 80 cm.",
      },
      {
        q: "Kan ik de banken ook los bestellen?",
        a: "Bij de meeste series staan de driezits, tweezits en fauteuil als aparte producten in de shop, zodat je zelf de combinatie samenstelt.",
      },
    ],
  },
  {
    slug: "fauteuils",
    label: "Fauteuils",
    intro: "Losse fauteuils en armstoelen — een comfortabele zit naast de bank of als accent.",
    dbCategories: ["fauteuils"],
    isUmbrella: false,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
  },
  {
    slug: "poefs",
    label: "Poefs",
    intro: "Poefs en zithockers — een zachte extra zit of voetensteun, in diverse kleuren en stoffen.",
    dbCategories: ["poefs"],
    isUmbrella: false,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
  },

  // ─── Tafels ──────────────────────────────────────────────────
  {
    slug: "tafels",
    label: "Tafels",
    intro: "Om de tafel wordt geleefd. Eettafels, salontafels en bijzettafels — filter op type.",
    dbCategories: ["tafels", "eettafels", "salontafels", "bijzettafels"],
    isUmbrella: true,
    group: "Tafels",
  },
  {
    slug: "eettafels",
    label: "Eettafels",
    intro: "De plek waar dagen beginnen en eindigen. Eettafels in eik, marmer en steen.",
    dbCategories: ["eettafels"],
    isUmbrella: false,
    group: "Tafels",
    seoIntro:
      "Een eettafel van 200 cm biedt plaats aan zes tot acht personen en vraagt een ruimte van minstens 3 m breed: reken op 90 tot 100 cm vrije ruimte rondom, zodat stoelen naar achteren kunnen en je er langs kunt lopen. Voor vier personen volstaat 120 tot 140 cm, voor zes personen 160 tot 180 cm. Een ronde tafel van 120 cm doorsnede is geschikt voor vier tot vijf personen en past goed in een vierkante eetkamer. De standaard tafelhoogte is 75 tot 78 cm; kies daar een stoel bij met een zithoogte van 45 tot 48 cm.",
    metaDescription:
      "Eettafels in eiken, marmer en keramiek, van 120 tot 240 cm. Een tafel van 200 cm biedt plaats aan 6 tot 8 personen en vraagt een ruimte van minstens 3 m breed.",
    faq: [
      {
        q: "Hoe groot moet mijn eettafel zijn?",
        a: "Reken op 60 cm per persoon aan de lange zijde. Vier personen: 120 tot 140 cm, zes personen: 160 tot 180 cm, acht personen: 200 tot 240 cm. Houd rondom 90 tot 100 cm vrij voor stoelen en loopruimte.",
      },
      {
        q: "Past een eettafel van 200 cm in mijn eetkamer?",
        a: "Je hebt een ruimte nodig van minstens 3 m breed en 4 m lang: de tafel zelf plus 90 tot 100 cm aan elke kant om stoelen naar achteren te schuiven en erlangs te lopen.",
      },
      {
        q: "Wat is het verschil tussen een eiken en een keramiek tafelblad?",
        a: "Eiken is warm en kun je schuren en opnieuw oliën, maar het is gevoelig voor vocht en hitte. Keramiek is kras- en hittebestendig en vraagt weinig onderhoud, maar voelt koeler aan en is niet te repareren bij een beschadiging.",
      },
    ],
  },
  {
    slug: "salontafels",
    label: "Salontafels",
    intro: "Het middelpunt van de woonkamer — sculpturaal en functioneel.",
    dbCategories: ["salontafels"],
    isUmbrella: false,
    group: "Tafels",
    seoIntro:
      "Een salontafel kies je op de maat van je bank. Een vuistregel: de tafel is ongeveer twee derde van de zitlengte en het blad ligt op dezelfde hoogte als de zitting (40 tot 45 cm) of iets lager. Houd 40 tot 45 cm vrije ruimte tussen bank en tafel, zodat je er langs kunt en er met je benen bij kunt. Bij een hoekbank werkt een ronde of ovale tafel vaak prettig, omdat je er van meerdere kanten bij kunt zonder scherpe hoeken.",
    metaDescription:
      "Salontafels in hout, marmer en metaal. Kies de maat op je bank: twee derde van de zitlengte, bladhoogte 40-45 cm en 40 cm loopruimte rondom.",
    faq: [
      {
        q: "Welke maat salontafel past bij mijn bank?",
        a: "Neem ongeveer twee derde van de zitlengte van je bank. Bij een bank van 240 cm past dus een tafel van 140 tot 160 cm. Houd daarnaast 40 tot 45 cm ruimte tussen bank en tafel.",
      },
      {
        q: "Hoe hoog moet een salontafel zijn?",
        a: "Ongeveer gelijk aan de zithoogte van je bank, meestal 40 tot 45 cm, of een paar centimeter lager. Dan pak je makkelijk iets van tafel zonder te bukken.",
      },
      {
        q: "Rond of rechthoekig bij een hoekbank?",
        a: "Bij een hoekbank is een ronde of ovale tafel vaak praktischer: je loopt er makkelijker omheen en hebt geen scherpe hoek bij de zitting. Een rechthoekige tafel past beter bij een rechte bank.",
      },
    ],
  },
  {
    slug: "bijzettafels",
    label: "Bijzettafels",
    intro: "Klein maar betekenisvol. Accentstukken voor naast de bank of bij het bed.",
    dbCategories: ["bijzettafels"],
    isUmbrella: false,
    group: "Tafels",
  },
  {
    slug: "tv-meubels",
    label: "TV-meubels",
    intro: "Strakke lijnen voor het hart van je entertainmentruimte.",
    dbCategories: ["tv-meubels"],
    isUmbrella: false,
    group: "Tafels",
    seoIntro:
      "Kies een tv-meubel dat 20 tot 30 cm breder is dan je televisie, zodat het toestel niet over de randen hangt. Een tv van 55 inch is ongeveer 123 cm breed en past dus op een meubel van 150 cm of meer; bij 65 inch (145 cm) kies je 180 cm of breder. Een lage kast van 40 tot 50 cm hoog brengt het midden van het scherm op ooghoogte vanaf de bank. Let op ruimte voor een soundbar en op openingen aan de achterkant voor kabels en ventilatie van ontvangers.",
    metaDescription:
      "TV-meubels van 150 tot 240 cm breed in hout en metaal. Kies een meubel dat 20-30 cm breder is dan je televisie, bijvoorbeeld 180 cm bij een tv van 65 inch.",
    faq: [
      {
        q: "Hoe breed moet mijn tv-meubel zijn?",
        a: "Minstens 20 tot 30 cm breder dan je televisie. Een tv van 55 inch (123 cm breed) past op een meubel van 150 cm, een tv van 65 inch (145 cm) op een meubel van 180 cm of breder.",
      },
      {
        q: "Hoe hoog mag een tv-meubel zijn?",
        a: "Meestal 40 tot 50 cm. Het midden van het scherm komt dan op ooghoogte als je op de bank zit, zo'n 100 tot 110 cm vanaf de vloer.",
      },
      {
        q: "Is er ruimte voor kabels en apparatuur?",
        a: "Bij de specificaties staat of het meubel open vakken en kabeldoorvoeren heeft. Ontvangers en spelcomputers hebben een open vak of ventilatieopening nodig om warmte kwijt te kunnen.",
      },
    ],
  },

  // ─── Stoelen ─────────────────────────────────────────────────
  {
    slug: "stoelen",
    label: "Stoelen",
    intro: "Sculpturaal comfort — eetkamerstoelen en fauteuils. Filter op type.",
    dbCategories: ["stoelen", "eetkamerstoelen", "fauteuils"],
    isUmbrella: true,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
  },
  {
    slug: "eetkamerstoelen",
    label: "Eetkamerstoelen",
    intro: "De stoel waar je aan tafel op zit — comfortabel, stevig en mooi van lijn.",
    dbCategories: ["eetkamerstoelen"],
    isUmbrella: false,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
    seoIntro:
      "Een eetkamerstoel koop je op maat van je tafel: bij een tafelhoogte van 75 tot 78 cm past een zithoogte van 45 tot 48 cm, zodat je zo'n 28 tot 30 cm beenruimte overhoudt. Reken per stoel op 60 cm tafelbreedte; aan een tafel van 180 cm passen dus zes stoelen (drie per lange zijde). Stoelen met armleuningen vragen iets meer ruimte en schuiven alleen onder tafel als de armleuning lager is dan het tafelblad. Alle eetkamerstoelen zijn per stuk te bestellen en in de meeste modellen leverbaar in meerdere stofkleuren.",
    metaDescription:
      "Eetkamerstoelen in stof, velours en leer, per stuk te bestellen. Let op zithoogte (45-48 cm bij een tafel van 75 cm) en 60 cm breedte per stoel.",
    faq: [
      {
        q: "Welke zithoogte past bij mijn eettafel?",
        a: "Bij een standaard tafelhoogte van 75 tot 78 cm past een zithoogte van 45 tot 48 cm. Je houdt dan ongeveer 28 tot 30 cm ruimte tussen zitting en tafelblad, genoeg om comfortabel aan te schuiven.",
      },
      {
        q: "Hoeveel stoelen passen er aan mijn tafel?",
        a: "Reken op 60 cm breedte per persoon. Aan een tafel van 160 cm passen vier tot zes stoelen, aan 200 cm zes tot acht. Stoelen met armleuningen hebben ongeveer 5 cm extra nodig.",
      },
      {
        q: "Kan ik eetkamerstoelen per stuk bestellen?",
        a: "Ja, alle eetkamerstoelen bestel je per stuk. Je kiest zelf het aantal en in de meeste modellen ook de stofkleur.",
      },
    ],
  },

  // ─── Slapen ──────────────────────────────────────────────────
  {
    slug: "bedden",
    label: "Bedden",
    intro: "Slapen als ritueel. Boxsprings en bedframes voor diepe rust en stille ochtenden.",
    dbCategories: ["bedden"],
    isUmbrella: false,
    group: "Slapen",
    cardSubtitle: "In diverse maten.",
    seoIntro:
      "Een bed van 160 x 200 cm (tweepersoons) vraagt een slaapkamer van minstens 3 x 3,5 m: houd 60 tot 70 cm loopruimte aan weerszijden en aan het voeteneinde. Een bed van 180 x 200 cm geeft ieder 90 cm, net zo breed als een eenpersoonsbed. Kies de lengte op de langste slaper plus 20 cm; bij 1,90 m of langer is 210 of 220 cm prettiger. Een boxspring is inclusief matras en staat hoger (ongeveer 60 cm) dan een bedframe met lattenbodem (45 tot 55 cm), wat het in- en uitstappen makkelijker maakt.",
    metaDescription:
      "Bedden en boxsprings van 140 tot 200 cm breed. Een bed van 160 x 200 cm past in een slaapkamer van minstens 3 x 3,5 m, met 60 cm loopruimte rondom.",
    faq: [
      {
        q: "Welke bedmaat past in mijn slaapkamer?",
        a: "Tel bij de bedmaat 60 tot 70 cm loopruimte op aan elke vrije zijde. Een bed van 160 x 200 cm vraagt dus een ruimte van ongeveer 3 x 3,5 m, een bed van 180 x 200 cm minstens 3,2 x 3,5 m.",
      },
      {
        q: "Wat is het verschil tussen een boxspring en een bedframe?",
        a: "Een boxspring bestaat uit een geveerde onderbox, matras en vaak een topper, en is in één keer compleet. Een bedframe is alleen het frame; je kiest zelf een lattenbodem en matras. Een boxspring staat meestal hoger, rond de 60 cm.",
      },
      {
        q: "Hoe lang moet mijn bed zijn?",
        a: "Neem je lichaamslengte plus 20 cm. Tot 1,80 m volstaat 200 cm, bij 1,90 m of langer kies je liever 210 of 220 cm.",
      },
    ],
  },
  {
    slug: "matrassen",
    label: "Matrassen",
    intro: "Pocketveer en koudschuim — de basis van elke goede nachtrust.",
    dbCategories: ["matrassen"],
    isUmbrella: false,
    group: "Slapen",
  },
  {
    slug: "slaapkamers",
    label: "Slaapkamers",
    intro: "Rust begint hier. Zachte materialen en warme tinten voor de persoonlijkste ruimte.",
    dbCategories: ["slaapkamers"],
    isUmbrella: false,
    group: "Slapen",
  },
  {
    slug: "jeugdkamers",
    label: "Jeugdkamers",
    intro: "Complete kamers voor kinderen en tieners — bed, kast en bureau in één stijl.",
    dbCategories: ["jeugdkamers"],
    isUmbrella: false,
    group: "Slapen",
  },

  // ─── Opbergen ────────────────────────────────────────────────
  {
    slug: "kasten",
    label: "Alle kasten",
    intro: "Meer dan opbergruimte — kasten als architectuur die je interieur structureren.",
    dbCategories: ["kasten", "kledingkasten", "dressoirs", "nachtkastjes", "ladekasten", "kapstokken", "schoenenkasten"],
    isUmbrella: true,
    group: "Opbergen",
  },
  {
    slug: "kledingkasten",
    label: "Kledingkasten",
    intro: "Ruime garderobekasten met schuif- of draaideuren — orde in de slaapkamer.",
    dbCategories: ["kledingkasten"],
    isUmbrella: false,
    group: "Opbergen",
    seoIntro:
      "Reken voor één persoon op ongeveer 100 cm kastbreedte: 60 cm hanggedeelte en 40 cm legplanken. Een kledingkast van 200 cm breed is dus ruim voor twee personen. Schuifdeuren hebben geen draairuimte nodig en passen in een smalle slaapkamer; draaideuren vragen 50 tot 60 cm vrije ruimte voor de kast, maar geven een beter overzicht. Controleer de hoogte van je plafond: de meeste kasten zijn 200 tot 230 cm hoog en worden liggend in elkaar gezet, waarvoor je de diagonaal van de kast (hoogte plus diepte) aan vrije hoogte nodig hebt.",
    metaDescription:
      "Kledingkasten met schuif- of draaideuren, 100 tot 250 cm breed. Reken op 100 cm kastbreedte per persoon en kies schuifdeuren bij weinig ruimte voor de kast.",
    faq: [
      {
        q: "Schuifdeuren of draaideuren?",
        a: "Schuifdeuren hebben geen draairuimte nodig en zijn geschikt voor kleine slaapkamers of een kast naast het bed. Draaideuren vragen 50 tot 60 cm vrije ruimte, maar geven in één keer zicht op de hele kast.",
      },
      {
        q: "Hoe breed moet mijn kledingkast zijn?",
        a: "Ongeveer 100 cm per persoon, verdeeld over een hanggedeelte en legplanken. Voor twee personen is 200 cm een ruime maat; met veel jassen of lange kleding kies je breder.",
      },
      {
        q: "Wordt de kast gemonteerd geleverd?",
        a: "Kledingkasten worden als bouwpakket geleverd. Bij grote stukken is montage op afspraak mogelijk; neem daarvoor contact op na je bestelling.",
      },
    ],
  },
  {
    slug: "dressoirs",
    label: "Dressoirs",
    intro: "Lage opbergkasten voor de woon- of eetkamer — opbergruimte met allure.",
    dbCategories: ["dressoirs"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "nachtkastjes",
    label: "Nachtkastjes",
    intro: "Het kleine meubel naast je bed — voor wat altijd binnen handbereik moet zijn.",
    dbCategories: ["nachtkastjes"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "ladekasten",
    label: "Ladekasten & Commodes",
    intro: "Lades vol opbergruimte — commodes en ladekasten voor slaapkamer en hal.",
    dbCategories: ["ladekasten"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "kapstokken",
    label: "Kapstokken",
    intro: "Een warm welkom in de hal — kapstokken en garderobe-oplossingen.",
    dbCategories: ["kapstokken"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "schoenenkasten",
    label: "Schoenenkasten",
    intro: "Schoenen netjes uit het zicht — slanke kasten en lades voor in de hal.",
    dbCategories: ["schoenenkasten"],
    isUmbrella: false,
    group: "Opbergen",
  },

  // ─── Sfeer ───────────────────────────────────────────────────
  {
    slug: "verlichting",
    label: "Alle verlichting",
    intro: "Sfeer maken begint bij licht. Plafond-, vloer-, tafel- en wandlampen met karakter.",
    dbCategories: ["verlichting", "plafondlampen", "vloerlampen", "tafellampen", "wandlampen"],
    isUmbrella: true,
    group: "Sfeer",
  },
  {
    slug: "plafondlampen",
    label: "Plafondlampen",
    intro: "Het licht van bovenaf — hang- en plafondlampen die de ruimte definiëren.",
    dbCategories: ["plafondlampen"],
    isUmbrella: false,
    group: "Sfeer",
    seoIntro:
      "Boven de eettafel hang je een plafondlamp op 70 tot 80 cm boven het blad: laag genoeg voor gezellig licht, hoog genoeg om elkaar aan te kijken. Bij een tafel van 200 cm past een hanglamp van 100 tot 120 cm breed of een rij van drie kleinere lampen. In de woonkamer houd je minstens 2 m vrije hoogte onder de lamp aan, zodat je er niet tegenaan loopt. Kies een dimbare lichtbron (E27 of E14) en warm licht van 2700 K voor een rustige sfeer.",
    metaDescription:
      "Plafond- en hanglampen voor eettafel en woonkamer. Hang de lamp 70-80 cm boven het tafelblad en kies dimbaar warm licht van 2700 K voor een rustige sfeer.",
    faq: [
      {
        q: "Hoe hoog hang ik een lamp boven de eettafel?",
        a: "Tussen 70 en 80 cm boven het tafelblad. Zo verlicht de lamp de tafel goed zonder dat je er tegenaan kijkt als je zit.",
      },
      {
        q: "Hoe breed mag een hanglamp boven de tafel zijn?",
        a: "Ongeveer de helft tot twee derde van de tafellengte. Boven een tafel van 200 cm past een lamp van 100 tot 130 cm, of meerdere kleine lampen naast elkaar.",
      },
      {
        q: "Zijn de lampen dimbaar?",
        a: "De meeste modellen hebben een E27- of E14-fitting; met een dimbare ledlamp en een dimmer in de wand is de lamp dan dimbaar. Bij de specificaties staat welke fitting en welk maximaal wattage geldt.",
      },
    ],
  },
  {
    slug: "vloerlampen",
    label: "Vloerlampen",
    intro: "Staand licht voor een leeshoek of als sculpturaal accent naast de bank.",
    dbCategories: ["vloerlampen"],
    isUmbrella: false,
    group: "Sfeer",
  },
  {
    slug: "tafellampen",
    label: "Tafellampen",
    intro: "Warm licht op ooghoogte — voor op het dressoir, bureau of nachtkastje.",
    dbCategories: ["tafellampen"],
    isUmbrella: false,
    group: "Sfeer",
  },
  {
    slug: "wandlampen",
    label: "Wandlampen",
    intro: "Subtiel licht aan de muur — wandlampen en appliques voor sfeer en accent.",
    dbCategories: ["wandlampen"],
    isUmbrella: false,
    group: "Sfeer",
  },
  {
    slug: "spiegels",
    label: "Spiegels",
    intro: "Wandsculpturen die ruimte verdiepen en licht vermenigvuldigen.",
    dbCategories: ["spiegels"],
    isUmbrella: false,
    group: "Sfeer",
    seoIntro:
      "Een spiegel maakt een ruimte lichter en ruimer, vooral tegenover een raam. In de hal volstaat een spiegel van 50 tot 60 cm breed en 80 tot 100 cm hoog, zodat je jezelf tot je middel ziet. Wil je jezelf helemaal zien, kies dan een staande of hangende spiegel van minstens 160 cm hoog. Hang een spiegel zo dat het midden op ooghoogte zit, ongeveer 150 tot 160 cm vanaf de vloer. Boven een dressoir laat je 10 tot 20 cm ruimte tussen meubel en spiegel.",
    metaDescription:
      "Ronde en rechthoekige wandspiegels van 50 tot 180 cm. Kies 80-100 cm voor de hal of minstens 160 cm om jezelf helemaal te zien, met het midden op ooghoogte.",
    faq: [
      {
        q: "Welke maat spiegel past in de hal?",
        a: "Een spiegel van 50 tot 60 cm breed en 80 tot 100 cm hoog laat je jezelf tot je middel zien. Voor een volledig beeld kies je minstens 160 cm hoog.",
      },
      {
        q: "Op welke hoogte hang ik een spiegel?",
        a: "Met het midden op ooghoogte, ongeveer 150 tot 160 cm vanaf de vloer. Boven een dressoir of kast houd je 10 tot 20 cm tussenruimte.",
      },
      {
        q: "Hoe wordt een spiegel geleverd?",
        a: "Spiegels worden in een stevige verpakking met hoekbescherming verstuurd. Controleer bij ontvangst de verpakking en meld schade zo snel mogelijk, dan zoeken we samen een oplossing.",
      },
    ],
  },
] as const;

// ─── Lookup helpers ─────────────────────────────────────────────────

const VALID_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

export function isCategorySlug(slug: string): slug is CategorySlug {
  return VALID_SLUGS.has(slug);
}

export function getCategory(slug: string): Category | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/**
 * Geeft de canonieke route-slug voor een DB-product categorie, of `null` als
 * er geen route voor bestaat. Voorbeeld: db.category="hoekbanken" → "hoekbanken".
 * Nooit stilzwijgend terugvallen op een andere categorie: dat gaf een
 * redirect-lus op de productpagina.
 */
export function dbCategoryToRouteSlug(dbCategory: string): CategorySlug | null {
  return isCategorySlug(dbCategory) ? dbCategory : null;
}

/**
 * Bouwt de canonieke product-URL: /<categorie>/<slug>. Zonder bekende
 * categorie valt de link terug op de legacy-route /products/<slug>, die dan
 * een 404 geeft in plaats van naar een verkeerde categorie te sturen.
 */
export function productUrl(product: { category: string; slug: string }): string {
  const route = dbCategoryToRouteSlug(product.category);
  return route ? `/${route}/${product.slug}` : `/products/${product.slug}`;
}

/**
 * Welke categorie "past goed bij" een product uit een gegeven DB-categorie.
 * Gebruikt op de productpagina voor een extra rij aanvullende producten.
 */
const COMPLEMENTARY_CATEGORY: Readonly<Record<string, CategorySlug>> = {
  eettafels: "eetkamerstoelen",
  eetkamerstoelen: "eettafels",
  banken: "salontafels",
  hoekbanken: "salontafels",
  bankstellen: "salontafels",
  bedden: "nachtkastjes",
};

export function complementaryCategoryFor(dbCategory: string): Category | null {
  const slug = COMPLEMENTARY_CATEGORY[dbCategory];
  return slug ? getCategory(slug) : null;
}

/**
 * Bouwt categorie-URL: /<categorie>
 */
export function categoryUrl(slug: CategorySlug): string {
  return `/${slug}`;
}

/**
 * Groepering voor FilterBar (geprefereerde display-volgorde per groep).
 */
export const GROUP_ORDER: ReadonlyArray<Category["group"]> = [
  "Banken",
  "Tafels",
  "Stoelen",
  "Slapen",
  "Opbergen",
  "Sfeer",
] as const;
