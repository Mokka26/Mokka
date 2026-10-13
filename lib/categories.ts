/**
 * Bron van waarheid voor alle product-categorieën.
 *
 * Wordt gebruikt voor:
 *  - Route-validatie (`app/[category]/page.tsx`)
 *  - Sitemap generatie
 *  - FilterBar groepering
 *  - ProductsContent labels + intros
 *  - JSON-LD CollectionPage schema
 *  - Meta-titles/-descriptions (via lib/seo.ts)
 *
 * Pseudo-categorieën (zoals "banken" = umbrella) zijn expliciet
 * gemarkeerd; ze hebben geen 1-op-1 mapping naar Product.category in DB.
 *
 * De vuistregels met maten (GUIDELINES) staan hier één keer en worden
 * gebruikt in de categorie-teksten én in de woongidsen (app/gids/**).
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

/** Slugs van de woongidsen (app/gids/guides.ts is de registry met titels). */
export type GuideSlug = "eettafel-maat-kiezen" | "hoekbank-kiezen" | "bed-en-matras-kiezen" | "salontafel-afmetingen";

export type Category = {
  slug: CategorySlug;
  /** Weergavenaam in navigatie/koppen, bv. "Alle banken" of "TV-meubels". */
  label: string;
  /**
   * Naam in lopende tekst, meervoud en kleine letters, bv. "banken",
   * "tv-meubels". Bron voor titles en descriptions ("Bekijk alle banken").
   */
  name: string;
  intro: string;
  /**
   * DB-mapping: welke `Product.category` waardes vallen onder deze slug.
   * Umbrella's mappen naar meerdere DB-categorieën.
   */
  dbCategories: ReadonlyArray<string>;
  /** True voor umbrella's die meerdere DB-categorieën combineren */
  isUmbrella: boolean;
  /** Bovenliggende umbrella (kruimelpad Home > Banken > Hoekbanken). */
  parent?: CategorySlug;
  /** Hoort tot welke top-groep in FilterBar */
  group: "Banken" | "Tafels" | "Stoelen" | "Slapen" | "Opbergen" | "Sfeer";
  /**
   * Groep in de Google Shopping-feed (`g:product_type`) als die afwijkt van
   * `group`: tv-meubels horen daar bij Opbergen, poefs bij Zitten.
   */
  feedGroup?: string;
  /** Woongids die bij deze categorie past (link onder het intro). */
  guide?: GuideSlug;
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
   * Optioneel: korte, praktische tekst onder het productgrid (H2 "Over <name>").
   * Nuchter Nederlands, maten met context, geen claims. Ook de bron voor de
   * meta-description als `metaDescription` ontbreekt.
   */
  seoIntro?: string;
  /** Meta-description (140-160 tekens). Geen productbereiken die niet uit de DB komen. */
  metaDescription: string;
  /**
   * Optioneel: afwijkende toevoeging in de meta-title na "<Naam> kopen: ".
   * Standaard "maten, kleuren en levertijd" (zie lib/seo.ts).
   */
  titleSuffix?: string;
  /** Optioneel: 2-3 veelgestelde vragen, gerenderd als <details> + FAQPage-schema. */
  faq?: ReadonlyArray<{ q: string; a: string }>;
};

// ─── Vuistregels (één bron voor categorie-teksten en woongidsen) ────────

type CmRange = { min: number; max: number };

export const GUIDELINES = {
  /** Tafelbreedte per zitplaats aan een eettafel. */
  seatWidthCm: 60,
  /** Ruimere zit (brede stoelen met armleuning). */
  seatWidthWideCm: { min: 65, max: 70 } satisfies CmRange,
  /** Vrije ruimte rond een eettafel om een stoel naar achteren te schuiven. */
  tableClearanceCm: { min: 70, max: 80 } satisfies CmRange,
  /** Extra ruimte aan de kant van een looproute langs de tafel. */
  walkwayCm: { min: 90, max: 100 } satisfies CmRange,
  /** Tafelhoogte eettafel en bijpassende zithoogte van de stoel. */
  tableHeightCm: { min: 75, max: 78 } satisfies CmRange,
  chairSeatHeightCm: { min: 45, max: 48 } satisfies CmRange,
  /** Loopruimte langs de open zijden van een bank. */
  sofaWalkwayCm: 80,
  /** Afstand tussen bank en salontafel. */
  sofaToCoffeeTableCm: { min: 40, max: 45 } satisfies CmRange,
  /** Zithoogte van de meeste banken; salontafelblad gelijk of iets lager. */
  sofaSeatHeightCm: { min: 40, max: 45 } satisfies CmRange,
  /** Zitdiepte: rechtop versus lounge. */
  sofaSeatDepthCm: { min: 55, max: 60 } satisfies CmRange,
  sofaLoungeDepthCm: 70,
  /** Lengte salontafel ten opzichte van de zitlengte van de bank. */
  coffeeTableRatio: "twee derde",
  /** Gangbare matrasbreedtes; lengte standaard 200 cm. */
  mattressWidthsCm: [90, 140, 160, 180] as ReadonlyArray<number>,
  mattressLengthCm: 200,
  /** Bedlengte: lichaamslengte plus deze marge. */
  bedLengthExtraCm: 20,
  /** Loopruimte aan de vrije zijden van een bed. */
  bedClearanceCm: { min: 60, max: 70 } satisfies CmRange,
  /** Breedte van een standaard binnendeur. */
  doorWidthCm: 83,
  /** Tv-meubel breder dan de televisie. */
  tvOverhangCm: { min: 20, max: 30 } satisfies CmRange,
  /** Hanglamp boven het tafelblad. */
  lampAboveTableCm: { min: 70, max: 80 } satisfies CmRange,
} as const;

/** "70 tot 80 cm" */
export function cmRange(r: CmRange): string {
  return `${r.min} tot ${r.max} cm`;
}

const G = GUIDELINES;
const SOFA_GAP = cmRange(G.sofaToCoffeeTableCm);
const TABLE_CLEAR = cmRange(G.tableClearanceCm);
const MATTRESS_RANGE = `${G.mattressWidthsCm[0]} x ${G.mattressLengthCm} tot ${G.mattressWidthsCm[G.mattressWidthsCm.length - 1]} x ${G.mattressLengthCm} cm`;

export const CATEGORIES: ReadonlyArray<Category> = [
  // ─── Banken ──────────────────────────────────────────────────
  {
    slug: "banken",
    label: "Alle banken",
    name: "banken",
    intro: "De volledige bank-collectie — hoekbanken en bankstellen samen op één plek.",
    dbCategories: ["banken", "hoekbanken", "bankstellen"],
    isUmbrella: true,
    group: "Banken",
    guide: "hoekbank-kiezen",
    typeOrder: ["hoekbanken", "bankstellen"],
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
    seoIntro: `Een bank kies je op de ruimte en op hoe je zit. Reken op ongeveer ${G.seatWidthCm} cm zitbreedte per persoon, houd ${G.sofaWalkwayCm} cm loopruimte langs de open zijden en ${SOFA_GAP} tussen bank en salontafel. Een hoekbank biedt de meeste zitplaatsen op dezelfde vloeroppervlakte; een bankstel van losse banken is flexibeler bij verhuizen of herinrichten. Meet vooraf je voordeur en trap: grote banken komen in losse delen en de maten per deel staan bij de specificaties.`,
    metaDescription: `Hoekbanken en bankstellen in stof en leer. Reken op ${G.seatWidthCm} cm zitbreedte per persoon en ${G.sofaWalkwayCm} cm loopruimte; de maten per deel staan bij elk product.`,
    faq: [
      {
        q: "Hoekbank of bankstel?",
        a: "Een hoekbank is één aaneengesloten meubel in L- of U-vorm en biedt de meeste zitplaatsen op dezelfde oppervlakte. Een bankstel bestaat uit losse banken (bijvoorbeeld een driezits en een tweezits) die je vrij kunt neerzetten en later anders kunt opstellen.",
      },
      {
        q: "Hoeveel ruimte heb ik nodig voor een bank?",
        a: `Houd ${G.sofaWalkwayCm} cm loopruimte aan langs de open zijden en ${SOFA_GAP} tussen de bank en de salontafel. Een hoekbank van 280 x 200 cm vraagt zo een woonkamer van ongeveer 4 x 4 m.`,
      },
      {
        q: "Past een bank door mijn deur?",
        a: `Grote banken worden in losse delen geleverd. Meet de breedte van je voordeur (standaard ${G.doorWidthCm} cm), de gang, de trap en de bochten en vergelijk die met de maten per deel bij de specificaties van het product.`,
      },
    ],
  },
  {
    slug: "hoekbanken",
    label: "Hoekbanken",
    name: "hoekbanken",
    intro: "De volledige collectie — losse banken, L- en U-vormige hoekbanken en lage loungebanken.",
    dbCategories: ["hoekbanken"],
    isUmbrella: false,
    parent: "banken",
    group: "Banken",
    guide: "hoekbank-kiezen",
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
    seoIntro: `Een hoekbank van 280 x 200 cm biedt plaats aan vier tot vijf personen en vraagt een woonkamer van minstens 4 x 4 m, met ${G.sofaWalkwayCm} cm loopruimte langs de open zijden en ${SOFA_GAP} tot de salontafel. Let bij het kiezen op de richting van de hoek (links of rechts, gezien vanaf de voorkant) en op de zitdiepte: ${cmRange(G.sofaSeatDepthCm)} is normaal, ${G.sofaLoungeDepthCm} cm of meer is bedoeld om half liggend te zitten. Meet ook je voordeur en trap: de losse delen zijn meestal 90 tot 100 cm diep.`,
    metaDescription: `Hoekbanken in L- en U-vorm, links of rechts. Een hoekbank van 280 x 200 cm biedt plaats aan 4 tot 5 personen en vraagt een kamer van minstens 4 x 4 m.`,
    faq: [
      {
        q: "Hoe weet ik of ik een linkse of rechtse hoekbank nodig heb?",
        a: "Ga voor de bank staan en kijk ernaar. Zit het lange deel (de chaise longue of het hoekdeel) aan je linkerhand, dan is het een linkse uitvoering. Bij de productfoto's en specificaties staat welke richting je bestelt.",
      },
      {
        q: "Past een hoekbank door mijn deur?",
        a: `Hoekbanken worden in losse delen geleverd. Het grootste deel is meestal 90 tot 100 cm diep en 70 tot 90 cm hoog, en past zo door een standaard deur van ${G.doorWidthCm} cm breed. De exacte maten per deel staan bij de specificaties.`,
      },
      {
        q: "Welke zitdiepte is prettig?",
        a: `${cmRange(G.sofaSeatDepthCm)} zit rechtop en is prettig bij een televisieavond. ${G.sofaLoungeDepthCm} cm of meer is een loungediepte: je zit half liggend, met extra kussens in de rug.`,
      },
    ],
  },
  {
    slug: "bankstellen",
    label: "Bankstellen",
    name: "bankstellen",
    intro: "Complete zitcombinaties in 3+2+1 of 3+2 opstelling, in dezelfde stof en kleur.",
    dbCategories: ["bankstellen"],
    isUmbrella: false,
    parent: "banken",
    group: "Banken",
    guide: "hoekbank-kiezen",
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
    seoIntro: `Een bankstel is een set van twee of drie losse banken in dezelfde stof: een 3+2 of 3+2+1 opstelling. Een driezitsbank is 200 tot 230 cm breed, een tweezits 150 tot 180 cm. Zet je ze in een hoek tegenover elkaar, reken dan op een woonkamer van minstens 4 x 4 m met ${G.sofaWalkwayCm} cm loopruimte tussen de banken en de salontafel. Een bankstel is flexibeler dan een hoekbank: je kunt de losse delen later anders neerzetten of verhuizen door een smalle deur.`,
    metaDescription: `Bankstellen in 3+2 en 3+2+1 opstelling, in stof of leer. Een driezits is 200 tot 230 cm breed; tegenover elkaar vragen de banken een kamer van minstens 4 x 4 m.`,
    faq: [
      {
        q: "Wat is het verschil tussen een bankstel en een hoekbank?",
        a: "Een bankstel bestaat uit losse banken (bijvoorbeeld een driezits en een tweezits) die je vrij kunt neerzetten. Een hoekbank is één aaneengesloten meubel in L- of U-vorm en biedt meer zitplaatsen op dezelfde oppervlakte.",
      },
      {
        q: "Hoeveel ruimte heb ik nodig voor een 3+2 bankstel?",
        a: `Reken op minstens 4 x 4 m als de banken in een hoek staan. Tussen bank en salontafel houd je ${SOFA_GAP}, voor looproutes langs de banken ${G.sofaWalkwayCm} cm.`,
      },
      {
        q: "Kan ik de banken ook los bestellen?",
        a: "Dat verschilt per serie. Staan de driezits, tweezits en fauteuil als aparte producten in de shop, dan stel je zelf de combinatie samen; anders bestel je het bankstel als set.",
      },
    ],
  },
  {
    slug: "fauteuils",
    label: "Fauteuils",
    name: "fauteuils",
    intro: "Losse fauteuils en armstoelen — een comfortabele zit naast de bank.",
    dbCategories: ["fauteuils"],
    isUmbrella: false,
    parent: "stoelen",
    group: "Stoelen",
    guide: "hoekbank-kiezen",
    cardSubtitle: "In diverse kleuren.",
    seoIntro: `Een fauteuil staat meestal naast of tegenover de bank. Reken op een vloeroppervlak van ongeveer 90 x 90 cm per fauteuil en houd ${G.sofaWalkwayCm} cm loopruimte als er een route langs loopt. Kies de zithoogte op die van je bank (meestal ${cmRange(G.sofaSeatHeightCm)}), zodat je op gelijke hoogte zit. Een hogere rug en armleuningen op ongeveer 20 cm boven de zitting zitten prettig als je lang leest of televisie kijkt; een lage, brede fauteuil zit losser maar is lastiger om uit op te staan.`,
    metaDescription: `Fauteuils en armstoelen in stof en leer voor naast de bank. Reken op 90 x 90 cm vloerruimte en kies de zithoogte gelijk aan die van je bank (${cmRange(G.sofaSeatHeightCm)}).`,
    faq: [
      {
        q: "Hoeveel ruimte heb ik nodig voor een fauteuil?",
        a: `Reken op ongeveer 90 x 90 cm voor de fauteuil zelf en ${G.sofaWalkwayCm} cm loopruimte aan de kant waar je langs loopt. De exacte maten staan bij de specificaties.`,
      },
      {
        q: "Welke zithoogte is prettig?",
        a: `Ongeveer gelijk aan je bank, meestal ${cmRange(G.sofaSeatHeightCm)}. Een iets hogere zitting (45 cm of meer) is makkelijker om uit op te staan.`,
      },
      {
        q: "Past een fauteuil bij mijn bank?",
        a: "Dat hoeft niet dezelfde serie te zijn. Let op een vergelijkbare zithoogte en op een stof of kleur die bij de bank past; bij twijfel kom je de stalen bekijken in de showroom.",
      },
    ],
  },
  {
    slug: "poefs",
    label: "Poefs",
    name: "poefs",
    intro: "Poefs en zithockers — een zachte extra zit of voetensteun, in diverse kleuren en stoffen.",
    dbCategories: ["poefs"],
    isUmbrella: false,
    group: "Stoelen",
    feedGroup: "Zitten",
    cardSubtitle: "In diverse kleuren.",
    metaDescription: `Poefs en zithockers als extra zitplaats of voetensteun bij de bank. Kies de hoogte gelijk aan de zithoogte van je bank (${cmRange(G.sofaSeatHeightCm)}). Prijzen incl. btw.`,
  },

  // ─── Tafels ──────────────────────────────────────────────────
  {
    slug: "tafels",
    label: "Tafels",
    name: "tafels",
    intro: "Om de tafel wordt geleefd. Eettafels, salontafels en bijzettafels — filter op type.",
    dbCategories: ["tafels", "eettafels", "salontafels", "bijzettafels"],
    isUmbrella: true,
    group: "Tafels",
    guide: "eettafel-maat-kiezen",
    seoIntro: `Welke tafel je nodig hebt, hangt af van de plek. Een eettafel kies je op het aantal personen: reken ${G.seatWidthCm} cm per zitplaats en ${TABLE_CLEAR} vrije ruimte rondom om stoelen naar achteren te schuiven. Een salontafel kies je op je bank: ongeveer ${G.coffeeTableRatio} van de zitlengte, met het blad op zithoogte en ${SOFA_GAP} afstand tot de bank. Een bijzettafel is kleiner en iets hoger en staat naast de bank of het bed, binnen handbereik.`,
    metaDescription: `Eettafels, salontafels en bijzettafels. Reken ${G.seatWidthCm} cm per zitplaats aan een eettafel en kies de salontafel op ${G.coffeeTableRatio} van je bank. Prijzen incl. btw.`,
    faq: [
      {
        q: "Hoe groot moet mijn eettafel zijn?",
        a: `Reken op ${G.seatWidthCm} cm per persoon aan de lange zijde: vier personen 120 tot 140 cm, zes personen 160 tot 180 cm, acht personen 200 tot 240 cm. Houd rondom ${TABLE_CLEAR} vrij.`,
      },
      {
        q: "Welke salontafel past bij mijn bank?",
        a: `Neem ongeveer ${G.coffeeTableRatio} van de zitlengte van de bank en kies een bladhoogte gelijk aan de zithoogte of iets lager. Houd ${SOFA_GAP} tussen bank en tafel.`,
      },
      {
        q: "Wat is het verschil tussen een salontafel en een bijzettafel?",
        a: "Een salontafel staat vóór de bank en is het middelpunt van de zithoek. Een bijzettafel is kleiner, meestal 45 tot 60 cm hoog, en staat naast de bank of een fauteuil voor een kop koffie of een lamp.",
      },
    ],
  },
  {
    slug: "eettafels",
    label: "Eettafels",
    name: "eettafels",
    intro: "De plek waar dagen beginnen en eindigen. Eettafels in eik, marmer en steen.",
    dbCategories: ["eettafels"],
    isUmbrella: false,
    parent: "tafels",
    group: "Tafels",
    guide: "eettafel-maat-kiezen",
    seoIntro: `Een eettafel van 200 cm biedt plaats aan zes tot acht personen. Reken op ${TABLE_CLEAR} vrije ruimte rondom, zodat stoelen naar achteren kunnen; aan de kant van een looproute ${cmRange(G.walkwayCm)}. Een tafel van 200 x 100 cm vraagt zo een vrije ruimte van ongeveer 3,6 x 2,6 m. Voor vier personen volstaat 120 tot 140 cm, voor zes personen 160 tot 180 cm. Een ronde tafel van 120 cm doorsnede is geschikt voor vier tot vijf personen en past goed in een vierkante eetkamer. De standaard tafelhoogte is ${cmRange(G.tableHeightCm)}; kies daar een stoel bij met een zithoogte van ${cmRange(G.chairSeatHeightCm)}.`,
    metaDescription: `Eettafels in eiken, marmer en keramiek, rond en rechthoekig. Reken ${G.seatWidthCm} cm per persoon: een tafel van 200 cm biedt plaats aan 6 tot 8 personen. Prijzen incl. btw.`,
    faq: [
      {
        q: "Hoe groot moet mijn eettafel zijn?",
        a: `Reken op ${G.seatWidthCm} cm per persoon aan de lange zijde. Vier personen: 120 tot 140 cm, zes personen: 160 tot 180 cm, acht personen: 200 tot 240 cm. Houd rondom ${TABLE_CLEAR} vrij voor stoelen en loopruimte.`,
      },
      {
        q: "Past een eettafel van 200 cm in mijn eetkamer?",
        a: `Een tafel van 200 x 100 cm met ${G.tableClearanceCm.max} cm rondom vraagt een vrije ruimte van ongeveer 3,6 x 2,6 m. Loopt er een route langs de tafel, houd aan die kant dan ${cmRange(G.walkwayCm)} aan.`,
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
    name: "salontafels",
    intro: "Salontafels voor vóór de bank, rond en rechthoekig. Kies de maat op de lengte van je bank.",
    dbCategories: ["salontafels"],
    isUmbrella: false,
    parent: "tafels",
    group: "Tafels",
    guide: "salontafel-afmetingen",
    seoIntro: `Een salontafel kies je op de maat van je bank. Een vuistregel: de tafel is ongeveer ${G.coffeeTableRatio} van de zitlengte en het blad ligt op dezelfde hoogte als de zitting (${cmRange(G.sofaSeatHeightCm)}) of iets lager. Houd ${SOFA_GAP} vrije ruimte tussen bank en tafel, zodat je er langs kunt en er met je benen bij kunt. Bij een hoekbank werkt een ronde of ovale tafel vaak prettig, omdat je er van meerdere kanten bij kunt zonder scherpe hoeken.`,
    metaDescription: `Salontafels in hout, marmer en metaal. Kies de maat op je bank: ${G.coffeeTableRatio} van de zitlengte, bladhoogte ${cmRange(G.sofaSeatHeightCm)} en ${G.sofaToCoffeeTableCm.min} cm tot de bank. Prijzen incl. btw.`,
    faq: [
      {
        q: "Welke maat salontafel past bij mijn bank?",
        a: `Neem ongeveer ${G.coffeeTableRatio} van de zitlengte van je bank. Bij een bank van 240 cm past dus een tafel van 140 tot 160 cm. Houd daarnaast ${SOFA_GAP} ruimte tussen bank en tafel.`,
      },
      {
        q: "Hoe hoog moet een salontafel zijn?",
        a: `Ongeveer gelijk aan de zithoogte van je bank, meestal ${cmRange(G.sofaSeatHeightCm)}, of een paar centimeter lager. Dan pak je makkelijk iets van tafel zonder te bukken.`,
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
    name: "bijzettafels",
    intro: "Kleine tafels voor naast de bank, de fauteuil of het bed, binnen handbereik.",
    dbCategories: ["bijzettafels"],
    isUmbrella: false,
    parent: "tafels",
    group: "Tafels",
    guide: "salontafel-afmetingen",
    seoIntro: `Een bijzettafel staat naast de bank, een fauteuil of het bed en is bedoeld voor wat je binnen handbereik wilt hebben: een kop koffie, een boek of een lamp. Kies de hoogte op de armleuning van je bank of fauteuil, meestal 45 tot 60 cm, zodat je niet hoeft te reiken. Een blad van 35 tot 50 cm doorsnede is genoeg voor een lamp en een glas. In een kleine woonkamer kunnen twee bijzettafels de salontafel vervangen; je houdt dan meer vloer vrij en schuift ze naar waar je ze nodig hebt.`,
    metaDescription: `Bijzettafels voor naast de bank, fauteuil of bed. Kies de hoogte op je armleuning (45 tot 60 cm) en een blad van 35 tot 50 cm voor een lamp en een glas.`,
    faq: [
      {
        q: "Hoe hoog moet een bijzettafel zijn?",
        a: "Ongeveer gelijk aan de armleuning van je bank of fauteuil, meestal 45 tot 60 cm. Naast het bed kies je de hoogte van de bovenkant van het matras.",
      },
      {
        q: "Kan een bijzettafel de salontafel vervangen?",
        a: "In een kleine woonkamer wel: twee bijzettafels naast de bank houden de vloer vrij en zijn makkelijk te verschuiven. Bij een grote hoekbank is een salontafel meestal praktischer.",
      },
      {
        q: "Welke maat blad is handig?",
        a: "Een blad van 35 tot 50 cm doorsnede biedt ruimte aan een lamp, een glas en een boek. De exacte maten staan bij de specificaties van elke tafel.",
      },
    ],
  },
  {
    slug: "tv-meubels",
    label: "TV-meubels",
    name: "tv-meubels",
    intro: "Lage kasten voor de televisie, met ruimte voor apparatuur en kabels.",
    dbCategories: ["tv-meubels"],
    isUmbrella: false,
    group: "Tafels",
    feedGroup: "Opbergen",
    seoIntro: `Kies een tv-meubel dat ${cmRange(G.tvOverhangCm)} breder is dan je televisie, zodat het toestel niet over de randen hangt. Een tv van 55 inch is ongeveer 123 cm breed en past dus op een meubel van 150 cm of meer; bij 65 inch (145 cm) kies je 180 cm of breder. Een lage kast van 40 tot 50 cm hoog brengt het midden van het scherm op ooghoogte vanaf de bank. Let op ruimte voor een soundbar en op openingen aan de achterkant voor kabels en ventilatie van ontvangers.`,
    metaDescription: `TV-meubels in hout en metaal. Kies een meubel dat ${cmRange(G.tvOverhangCm)} breder is dan je televisie, bijvoorbeeld 180 cm bij een tv van 65 inch, en 40 tot 50 cm hoog.`,
    faq: [
      {
        q: "Hoe breed moet mijn tv-meubel zijn?",
        a: `Minstens ${cmRange(G.tvOverhangCm)} breder dan je televisie. Een tv van 55 inch (123 cm breed) past op een meubel van 150 cm, een tv van 65 inch (145 cm) op een meubel van 180 cm of breder.`,
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
    name: "stoelen",
    intro: "Eetkamerstoelen en fauteuils op één plek. Filter op type.",
    dbCategories: ["stoelen", "eetkamerstoelen", "fauteuils"],
    isUmbrella: true,
    group: "Stoelen",
    guide: "eettafel-maat-kiezen",
    cardSubtitle: "In diverse kleuren.",
    seoIntro: `Een eetkamerstoel kies je op de hoogte van je tafel: bij een tafelhoogte van ${cmRange(G.tableHeightCm)} past een zithoogte van ${cmRange(G.chairSeatHeightCm)}. Reken per stoel op ${G.seatWidthCm} cm tafelbreedte; stoelen met armleuningen vragen iets meer en schuiven alleen onder tafel als de armleuning lager is dan het blad. Een fauteuil kies je op de zithoogte van je bank (${cmRange(G.sofaSeatHeightCm)}), zodat je op gelijke hoogte zit. Let bij stof op de slijtvastheid als je kinderen of huisdieren hebt; leer is makkelijk schoon te maken.`,
    metaDescription: `Eetkamerstoelen en fauteuils in stof, velours en leer. Kies de zithoogte op je tafel (${cmRange(G.chairSeatHeightCm)} bij ${G.tableHeightCm.min} cm) of op je bank. Prijzen incl. btw.`,
    faq: [
      {
        q: "Welke zithoogte past bij mijn eettafel?",
        a: `Bij een tafelhoogte van ${cmRange(G.tableHeightCm)} past een zithoogte van ${cmRange(G.chairSeatHeightCm)}. Je houdt dan ongeveer 28 tot 30 cm tussen zitting en tafelblad.`,
      },
      {
        q: "Hoeveel stoelen passen er aan mijn tafel?",
        a: `Reken op ${G.seatWidthCm} cm breedte per persoon. Aan een tafel van 160 cm passen vier tot zes stoelen, aan 200 cm zes tot acht. Stoelen met armleuningen hebben ongeveer 5 cm extra nodig.`,
      },
      {
        q: "Stof of leer?",
        a: "Stof voelt warm aan en is er in veel kleuren; kies bij kinderen of huisdieren een stof met hoge slijtvastheid. Leer is glad, houdt haren en kruimels niet vast en is met een vochtige doek schoon te maken.",
      },
    ],
  },
  {
    slug: "eetkamerstoelen",
    label: "Eetkamerstoelen",
    name: "eetkamerstoelen",
    intro: "De stoel waar je aan tafel op zit — comfortabel, stevig en mooi van lijn.",
    dbCategories: ["eetkamerstoelen"],
    isUmbrella: false,
    parent: "stoelen",
    group: "Stoelen",
    guide: "eettafel-maat-kiezen",
    cardSubtitle: "In diverse kleuren.",
    seoIntro: `Een eetkamerstoel koop je op maat van je tafel: bij een tafelhoogte van ${cmRange(G.tableHeightCm)} past een zithoogte van ${cmRange(G.chairSeatHeightCm)}, zodat je zo'n 28 tot 30 cm beenruimte overhoudt. Reken per stoel op ${G.seatWidthCm} cm tafelbreedte; aan een tafel van 180 cm passen dus zes stoelen (drie per lange zijde). Stoelen met armleuningen vragen iets meer ruimte en schuiven alleen onder tafel als de armleuning lager is dan het tafelblad. Of een stoel per stuk of per set wordt verkocht en in welke kleuren hij leverbaar is, staat bij het product.`,
    metaDescription: `Eetkamerstoelen in stof, velours en leer. Let op de zithoogte (${cmRange(G.chairSeatHeightCm)} bij een tafel van ${G.tableHeightCm.min} cm) en reken ${G.seatWidthCm} cm breedte per stoel. Prijzen incl. btw.`,
    faq: [
      {
        q: "Welke zithoogte past bij mijn eettafel?",
        a: `Bij een standaard tafelhoogte van ${cmRange(G.tableHeightCm)} past een zithoogte van ${cmRange(G.chairSeatHeightCm)}. Je houdt dan ongeveer 28 tot 30 cm ruimte tussen zitting en tafelblad, genoeg om comfortabel aan te schuiven.`,
      },
      {
        q: "Hoeveel stoelen passen er aan mijn tafel?",
        a: `Reken op ${G.seatWidthCm} cm breedte per persoon. Aan een tafel van 160 cm passen vier tot zes stoelen, aan 200 cm zes tot acht. Stoelen met armleuningen hebben ongeveer 5 cm extra nodig.`,
      },
      {
        q: "Kan ik eetkamerstoelen per stuk bestellen?",
        a: "Dat verschilt per model. Bij het product staat of je per stuk of per set bestelt en in welke kleuren de stoel leverbaar is.",
      },
    ],
  },

  // ─── Slapen ──────────────────────────────────────────────────
  {
    slug: "bedden",
    label: "Bedden",
    name: "bedden",
    intro: `Boxsprings en bedframes in de gangbare maten van ${G.mattressWidthsCm[0]} tot ${G.mattressWidthsCm[G.mattressWidthsCm.length - 1]} cm breed.`,
    dbCategories: ["bedden"],
    isUmbrella: false,
    group: "Slapen",
    guide: "bed-en-matras-kiezen",
    cardSubtitle: "In diverse maten.",
    seoIntro: `Een bed van 160 x 200 cm (tweepersoons) vraagt een slaapkamer van minstens 3 x 3,5 m: houd ${cmRange(G.bedClearanceCm)} loopruimte aan weerszijden en aan het voeteneinde. Een bed van 180 x 200 cm geeft ieder 90 cm, net zo breed als een eenpersoonsbed. Kies de lengte op de langste slaper plus ${G.bedLengthExtraCm} cm; bij 1,90 m of langer is 210 of 220 cm prettiger. Een boxspring is inclusief matras en staat hoger (ongeveer 60 cm) dan een bedframe met lattenbodem (45 tot 55 cm), wat het in- en uitstappen makkelijker maakt.`,
    metaDescription: `Bedden en boxsprings in de maten ${MATTRESS_RANGE}. Een bed van 160 x 200 cm past in een slaapkamer van minstens 3 x 3,5 m met ${G.bedClearanceCm.min} cm loopruimte.`,
    faq: [
      {
        q: "Welke bedmaat past in mijn slaapkamer?",
        a: `Tel bij de bedmaat ${cmRange(G.bedClearanceCm)} loopruimte op aan elke vrije zijde. Een bed van 160 x 200 cm vraagt dus een ruimte van ongeveer 3 x 3,5 m, een bed van 180 x 200 cm minstens 3,2 x 3,5 m.`,
      },
      {
        q: "Wat is het verschil tussen een boxspring en een bedframe?",
        a: "Een boxspring bestaat uit een geveerde onderbox, matras en vaak een topper, en is in één keer compleet. Een bedframe is alleen het frame; je kiest zelf een lattenbodem en matras. Een boxspring staat meestal hoger, rond de 60 cm.",
      },
      {
        q: "Hoe lang moet mijn bed zijn?",
        a: `Neem je lichaamslengte plus ${G.bedLengthExtraCm} cm. Tot 1,80 m volstaat ${G.mattressLengthCm} cm, bij 1,90 m of langer kies je liever 210 of 220 cm.`,
      },
    ],
  },
  {
    slug: "matrassen",
    label: "Matrassen",
    name: "matrassen",
    intro: "Matrassen in de gangbare maten. Kies op breedte, lengte en hardheid.",
    dbCategories: ["matrassen"],
    isUmbrella: false,
    group: "Slapen",
    guide: "bed-en-matras-kiezen",
    titleSuffix: "maten, hardheid en levertijd",
    seoIntro: `Een matras kies je op maat, hardheid en type. De gangbare maten lopen van ${MATTRESS_RANGE}; reken als volwassene op 80 tot 90 cm breedte om vrij te kunnen draaien, en neem als lengte je lichaamslengte plus ${G.bedLengthExtraCm} cm. De hardheid hangt af van je gewicht en slaaphouding: zwaardere slapers en rugslapers liggen meestal beter op een steviger matras, zijslapers op een iets zachter matras dat de schouder laat wegzakken. In een tweepersoonsbed kun je twee losse matrassen van 80 of 90 cm leggen, zodat ieder zijn eigen hardheid kiest.`,
    metaDescription: `Matrassen in de maten ${MATTRESS_RANGE}. Reken op 80 tot 90 cm breedte per persoon en je lichaamslengte plus ${G.bedLengthExtraCm} cm. Prijzen incl. btw.`,
    faq: [
      {
        q: "Welke matrasmaat heb ik nodig?",
        a: `Per volwassene 80 tot 90 cm breedte: ${G.mattressWidthsCm[0]} cm voor één persoon, 160 of 180 cm voor twee. De lengte is je lichaamslengte plus ${G.bedLengthExtraCm} cm; tot 1,80 m volstaat ${G.mattressLengthCm} cm.`,
      },
      {
        q: "Hard of zacht?",
        a: "Zwaardere slapers en rugslapers liggen meestal beter op een steviger matras; zijslapers op een iets zachter matras dat de schouder en heup laat wegzakken. Kom bij twijfel proefliggen in de showroom.",
      },
      {
        q: "Twee losse matrassen of één groot matras?",
        a: "Slapen jullie verschillend (gewicht, voorkeur voor hardheid), kies dan twee losse matrassen van 80 of 90 cm. Een topper over beide matrassen verbergt de naad.",
      },
    ],
  },
  {
    slug: "slaapkamers",
    label: "Slaapkamers",
    name: "slaapkamers",
    intro: "Complete slaapkamers: bed, nachtkastjes en kast in één stijl.",
    dbCategories: ["slaapkamers"],
    isUmbrella: false,
    group: "Slapen",
    guide: "bed-en-matras-kiezen",
    metaDescription: `Complete slaapkamers met bed, nachtkastjes en kast in één stijl. Houd ${cmRange(G.bedClearanceCm)} loopruimte rond het bed; de maten per onderdeel staan bij het product.`,
  },
  {
    slug: "jeugdkamers",
    label: "Jeugdkamers",
    name: "jeugdkamers",
    intro: "Complete kamers voor kinderen en tieners — bed, kast en bureau in één stijl.",
    dbCategories: ["jeugdkamers"],
    isUmbrella: false,
    group: "Slapen",
    metaDescription: `Complete jeugdkamers voor kinderen en tieners: bed, kast en bureau in één stijl. De maten per onderdeel staan bij het product, zodat je weet of het past.`,
  },

  // ─── Opbergen ────────────────────────────────────────────────
  {
    slug: "kasten",
    label: "Alle kasten",
    name: "kasten",
    intro: "Kledingkasten, dressoirs, nachtkastjes, ladekasten en kapstokken — filter op type.",
    dbCategories: ["kasten", "kledingkasten", "dressoirs", "nachtkastjes", "ladekasten", "kapstokken", "schoenenkasten"],
    isUmbrella: true,
    group: "Opbergen",
    seoIntro: `Welke kast je nodig hebt, hangt af van wat erin moet. Voor kleding reken je op ongeveer 100 cm kastbreedte per persoon, verdeeld over hangruimte en legplanken. Een dressoir is een lage kast (meestal 70 tot 90 cm hoog) voor de woon- of eetkamer; een ladekast of commode heeft alleen lades en past in de slaapkamer of hal. Let bij elke kast op de hoogte van je plafond en op de draairuimte van deuren: schuifdeuren hebben geen draairuimte nodig, draaideuren vragen 50 tot 60 cm vrije ruimte voor de kast.`,
    metaDescription: `Kledingkasten, dressoirs, ladekasten, nachtkastjes en kapstokken. Reken op 100 cm kastbreedte per persoon voor kleding en let op de draairuimte van deuren.`,
    faq: [
      {
        q: "Wat is het verschil tussen een dressoir en een ladekast?",
        a: "Een dressoir is een lage, brede kast met deuren en soms lades, meestal voor de woon- of eetkamer. Een ladekast of commode heeft alleen lades en staat vaker in de slaapkamer of hal.",
      },
      {
        q: "Hoe breed moet een kledingkast zijn?",
        a: "Ongeveer 100 cm per persoon, verdeeld over een hanggedeelte en legplanken. Voor twee personen is 200 cm een ruime maat.",
      },
      {
        q: "Schuifdeuren of draaideuren?",
        a: "Schuifdeuren hebben geen draairuimte nodig en passen in een smalle kamer. Draaideuren vragen 50 tot 60 cm vrije ruimte voor de kast, maar geven in één keer zicht op de hele inhoud.",
      },
    ],
  },
  {
    slug: "kledingkasten",
    label: "Kledingkasten",
    name: "kledingkasten",
    intro: "Ruime garderobekasten met schuif- of draaideuren — orde in de slaapkamer.",
    dbCategories: ["kledingkasten"],
    isUmbrella: false,
    parent: "kasten",
    group: "Opbergen",
    seoIntro:
      "Reken voor één persoon op ongeveer 100 cm kastbreedte: 60 cm hanggedeelte en 40 cm legplanken. Een kledingkast van 200 cm breed is dus ruim voor twee personen. Schuifdeuren hebben geen draairuimte nodig en passen in een smalle slaapkamer; draaideuren vragen 50 tot 60 cm vrije ruimte voor de kast, maar geven een beter overzicht. Controleer de hoogte van je plafond: de meeste kasten zijn 200 tot 230 cm hoog en worden liggend in elkaar gezet, waarvoor je de diagonaal van de kast (hoogte plus diepte) aan vrije hoogte nodig hebt.",
    metaDescription:
      "Kledingkasten met schuif- of draaideuren. Reken op 100 cm kastbreedte per persoon en kies schuifdeuren bij weinig ruimte voor de kast. Montage op afspraak.",
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
        a: "Hoe de kast geleverd wordt, staat bij het product. Montage is op afspraak mogelijk bij grote stukken; geef het aan bij je bestelling, dan hoor je de mogelijkheden en eventuele kosten.",
      },
    ],
  },
  {
    slug: "dressoirs",
    label: "Dressoirs",
    name: "dressoirs",
    intro: "Lage opbergkasten voor de woon- of eetkamer — opbergruimte met allure.",
    dbCategories: ["dressoirs"],
    isUmbrella: false,
    parent: "kasten",
    group: "Opbergen",
    metaDescription: `Dressoirs voor de woon- of eetkamer: lage kasten van 70 tot 90 cm hoog met deuren en lades. Laat 10 tot 20 cm ruimte tot een spiegel of lamp erboven.`,
  },
  {
    slug: "nachtkastjes",
    label: "Nachtkastjes",
    name: "nachtkastjes",
    intro: "Het kleine meubel naast je bed — voor wat altijd binnen handbereik moet zijn.",
    dbCategories: ["nachtkastjes"],
    isUmbrella: false,
    parent: "kasten",
    group: "Opbergen",
    guide: "bed-en-matras-kiezen",
    seoIntro: `Een nachtkastje kies je op de hoogte van je bed: ongeveer gelijk aan de bovenkant van het matras of iets lager, zodat je zonder reiken bij een glas water of de wekker kunt. Bij een boxspring van 60 cm hoog past een kastje van 50 tot 60 cm, bij een laag bedframe eerder 40 tot 45 cm. Een nachtkastje is meestal 40 tot 60 cm breed; tel aan beide zijden die breedte op bij de buitenmaat van het bed om te weten hoeveel wand je nodig hebt. Een lade houdt het blad vrij voor een lamp en een boek.`,
    metaDescription: `Nachtkastjes voor naast het bed, met of zonder lade. Kies de hoogte gelijk aan de bovenkant van het matras en reken op 40 tot 60 cm breedte per kastje.`,
    faq: [
      {
        q: "Hoe hoog moet een nachtkastje zijn?",
        a: "Ongeveer gelijk aan de bovenkant van je matras of iets lager. Bij een boxspring van 60 cm hoog past 50 tot 60 cm, bij een laag bedframe 40 tot 45 cm.",
      },
      {
        q: "Hoeveel ruimte heb ik nodig naast het bed?",
        a: "Een nachtkastje is meestal 40 tot 60 cm breed. Een bed van 180 cm met twee kastjes van 50 cm vraagt dus een wand van minstens 280 cm.",
      },
      {
        q: "Met of zonder lade?",
        a: "Een lade houdt het blad vrij voor een lamp, een boek en een glas. Een open vak is lager en oogt lichter, maar laat alles in het zicht.",
      },
    ],
  },
  {
    slug: "ladekasten",
    label: "Ladekasten en commodes",
    name: "ladekasten",
    intro: "Lades vol opbergruimte — commodes en ladekasten voor slaapkamer en hal.",
    dbCategories: ["ladekasten"],
    isUmbrella: false,
    parent: "kasten",
    group: "Opbergen",
    metaDescription: `Ladekasten en commodes voor slaapkamer en hal. Reken op 50 tot 60 cm vrije ruimte voor de kast om de lades helemaal open te trekken. Prijzen incl. btw.`,
  },
  {
    slug: "kapstokken",
    label: "Kapstokken",
    name: "kapstokken",
    intro: "Een warm welkom in de hal — kapstokken en garderobe-oplossingen.",
    dbCategories: ["kapstokken"],
    isUmbrella: false,
    parent: "kasten",
    group: "Opbergen",
    metaDescription: `Kapstokken en garderobes voor de hal, hangend en staand. Hang een wandkapstok op ongeveer 160 tot 170 cm hoogte, zodat lange jassen vrij hangen.`,
  },
  {
    slug: "schoenenkasten",
    label: "Schoenenkasten",
    name: "schoenenkasten",
    intro: "Schoenen netjes uit het zicht — slanke kasten en lades voor in de hal.",
    dbCategories: ["schoenenkasten"],
    isUmbrella: false,
    parent: "kasten",
    group: "Opbergen",
    metaDescription: `Schoenenkasten voor de hal: slanke kasten met klep of lades die schoenen uit het zicht houden. Reken op ongeveer 25 cm breedte per paar. Prijzen incl. btw.`,
  },

  // ─── Sfeer ───────────────────────────────────────────────────
  {
    slug: "verlichting",
    label: "Alle verlichting",
    name: "verlichting",
    intro: "Sfeer maken begint bij licht. Plafond-, vloer-, tafel- en wandlampen met karakter.",
    dbCategories: ["verlichting", "plafondlampen", "vloerlampen", "tafellampen", "wandlampen"],
    isUmbrella: true,
    group: "Sfeer",
    seoIntro: `Goede verlichting bestaat uit lagen. Een plafond- of hanglamp geeft het algemene licht; boven de eettafel hang je die ${cmRange(G.lampAboveTableCm)} boven het blad. Een vloerlamp naast de bank of een tafellamp op het dressoir geeft licht op ooghoogte voor lezen en sfeer. Wandlampen verlichten een gang of een muur zonder vloerruimte in te nemen. Kies overal dezelfde kleurtemperatuur, meestal warm licht van 2700 K, en dimbare lichtbronnen; bij de specificaties staat welke fitting en welk maximaal wattage geldt.`,
    metaDescription: `Plafond-, vloer-, tafel- en wandlampen. Hang een lamp ${cmRange(G.lampAboveTableCm)} boven de eettafel en kies overal warm, dimbaar licht van 2700 K. Prijzen incl. btw.`,
    faq: [
      {
        q: "Welke lamp hoort waar?",
        a: "Een plafond- of hanglamp voor het algemene licht, een vloerlamp bij de bank of leesstoel, een tafellamp op dressoir of nachtkastje en wandlampen in de gang of langs een muur. Combineer ze, zodat je niet alles uit één bron hoeft te halen.",
      },
      {
        q: "Welke kleurtemperatuur kies ik?",
        a: "Voor woonruimtes meestal warm licht van 2700 K. Houd in één ruimte dezelfde kleurtemperatuur aan, anders oogt het ene licht geel en het andere blauw.",
      },
      {
        q: "Zijn de lampen dimbaar?",
        a: "Met een dimbare ledlamp en een geschikte dimmer meestal wel. Bij de specificaties staat welke fitting (E27, E14 of ingebouwde led) en welk maximaal wattage geldt.",
      },
    ],
  },
  {
    slug: "plafondlampen",
    label: "Plafondlampen",
    name: "plafondlampen",
    intro: "Het licht van bovenaf — hang- en plafondlampen die de ruimte definiëren.",
    dbCategories: ["plafondlampen"],
    isUmbrella: false,
    parent: "verlichting",
    group: "Sfeer",
    seoIntro: `Boven de eettafel hang je een plafondlamp op ${cmRange(G.lampAboveTableCm)} boven het blad: laag genoeg voor gezellig licht, hoog genoeg om elkaar aan te kijken. Bij een tafel van 200 cm past een hanglamp van 100 tot 120 cm breed of een rij van drie kleinere lampen. In de woonkamer houd je minstens 2 m vrije hoogte onder de lamp aan, zodat je er niet tegenaan loopt. Kies een dimbare lichtbron (E27 of E14) en warm licht van 2700 K voor een rustige sfeer.`,
    metaDescription: `Plafond- en hanglampen voor eettafel en woonkamer. Hang de lamp ${cmRange(G.lampAboveTableCm)} boven het tafelblad en kies dimbaar warm licht van 2700 K. Prijzen incl. btw.`,
    faq: [
      {
        q: "Hoe hoog hang ik een lamp boven de eettafel?",
        a: `Tussen ${G.lampAboveTableCm.min} en ${G.lampAboveTableCm.max} cm boven het tafelblad. Zo verlicht de lamp de tafel goed zonder dat je er tegenaan kijkt als je zit.`,
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
    name: "vloerlampen",
    intro: "Staand licht voor een leeshoek of naast de bank.",
    dbCategories: ["vloerlampen"],
    isUmbrella: false,
    parent: "verlichting",
    group: "Sfeer",
    metaDescription: `Vloerlampen voor naast de bank of in een leeshoek. Een leeslamp schijnt van opzij over je schouder; een lamp van 150 tot 180 cm hoog geeft licht op ooghoogte.`,
  },
  {
    slug: "tafellampen",
    label: "Tafellampen",
    name: "tafellampen",
    intro: "Warm licht op ooghoogte — voor op het dressoir, bureau of nachtkastje.",
    dbCategories: ["tafellampen"],
    isUmbrella: false,
    parent: "verlichting",
    group: "Sfeer",
    metaDescription: `Tafellampen voor op het dressoir, bureau of nachtkastje. Naast het bed kies je een lamp van 40 tot 60 cm hoog, zodat de kap boven ooghoogte zit als je ligt.`,
  },
  {
    slug: "wandlampen",
    label: "Wandlampen",
    name: "wandlampen",
    intro: "Subtiel licht aan de muur — wandlampen en appliques voor sfeer en accent.",
    dbCategories: ["wandlampen"],
    isUmbrella: false,
    parent: "verlichting",
    group: "Sfeer",
    metaDescription: `Wandlampen voor gang, slaapkamer en woonkamer. Hang een wandlamp op ongeveer 160 tot 170 cm hoogte, net boven ooghoogte, zodat je niet in de lichtbron kijkt.`,
  },
  {
    slug: "spiegels",
    label: "Spiegels",
    name: "spiegels",
    intro: "Wandspiegels voor hal, slaapkamer en woonkamer; een spiegel tegenover een raam maakt een ruimte lichter.",
    dbCategories: ["spiegels"],
    isUmbrella: false,
    group: "Sfeer",
    seoIntro:
      "Een spiegel maakt een ruimte lichter en ruimer, vooral tegenover een raam. In de hal volstaat een spiegel van 50 tot 60 cm breed en 80 tot 100 cm hoog, zodat je jezelf tot je middel ziet. Wil je jezelf helemaal zien, kies dan een staande of hangende spiegel van minstens 160 cm hoog. Hang een spiegel zo dat het midden op ooghoogte zit, ongeveer 150 tot 160 cm vanaf de vloer. Boven een dressoir laat je 10 tot 20 cm ruimte tussen meubel en spiegel.",
    metaDescription:
      "Ronde en rechthoekige wandspiegels, met en zonder verlichting. Kies 80 tot 100 cm hoog voor de hal of minstens 160 cm om jezelf helemaal te zien.",
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
        q: "Wat doe ik bij schade aan een spiegel?",
        a: "Controleer bij ontvangst de verpakking en de spiegel en meld schade zo snel mogelijk via de contactpagina of telefonisch, dan zoeken we samen een oplossing.",
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
 * Kruimelpad-keten voor een categorie: Home > [umbrella >] categorie.
 * Zelfde items voor de zichtbare Breadcrumbs én het BreadcrumbList-schema;
 * de productpagina voegt daar het product achter.
 */
export function categoryBreadcrumbs(category: Category): Array<{ name: string; url: string }> {
  const chain: Array<{ name: string; url: string }> = [{ name: "Home", url: "/" }];
  const parent = category.parent ? getCategory(category.parent) : null;
  if (parent) chain.push({ name: parent.label, url: categoryUrl(parent.slug) });
  chain.push({ name: category.label, url: categoryUrl(category.slug) });
  return chain;
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
