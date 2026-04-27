/**
 * Editorial reviews per categorie. Hardcoded — geen DB.
 *
 * Geen review-submit flow: dit is content, geen functionaliteit. Voor een echte
 * shop met UGC zou je hier een Review model toevoegen.
 */

export interface Review {
  quote: string;
  name: string;
  city: string;
  rating: 4 | 5;
}

const reviewsByCategory: Record<string, Review[]> = {
  banken: [
    {
      quote: "De stof voelt direct aan dat hier vakmanschap achter zit. Na een half jaar dagelijks gebruik nog steeds geen plooi te zien.",
      name: "Maartje van der Linden",
      city: "Amsterdam",
      rating: 5,
    },
    {
      quote: "Stevig, comfortabel, en de afwerking is werkelijk perfect. Past prachtig bij onze interieurstijl.",
      name: "Daan Bekker",
      city: "Utrecht",
      rating: 5,
    },
    {
      quote: "Iets duurder dan ik gewend was, maar de kwaliteit rechtvaardigt het volledig. Levering was zorgvuldig.",
      name: "Sophie de Wit",
      city: "Den Haag",
      rating: 4,
    },
  ],
  bedden: [
    {
      quote: "Ik slaap voor het eerst in jaren weer goed. De kwaliteit van de matras en het frame is uitzonderlijk.",
      name: "Lieke Kuipers",
      city: "Rotterdam",
      rating: 5,
    },
    {
      quote: "De afwerking aan de binnenkant is even mooi als aan de buitenkant — typisch Mokka. Heel blij mee.",
      name: "Tom Jansen",
      city: "Eindhoven",
      rating: 5,
    },
    {
      quote: "Strak, tijdloos design dat over tien jaar nog niet gedateerd zal voelen. Aanrader.",
      name: "Anna Visser",
      city: "Groningen",
      rating: 4,
    },
  ],
  tafels: [
    {
      quote: "De tafel is het middelpunt van onze eetkamer geworden. Massief en mooi gepatineerd.",
      name: "Pieter Hofman",
      city: "Haarlem",
      rating: 5,
    },
    {
      quote: "Het hout is prachtig, je ziet de aderen goed terugkomen. Zeer tevreden met de keuze.",
      name: "Eva de Boer",
      city: "Leiden",
      rating: 5,
    },
    {
      quote: "Levertijd was iets langer dan beloofd, maar het eindresultaat is het waard.",
      name: "Marc Willemsen",
      city: "Nijmegen",
      rating: 4,
    },
  ],
  stoelen: [
    {
      quote: "Comfortabel zelfs bij lange diners. De zitting blijft mooi van vorm.",
      name: "Iris Mulder",
      city: "Maastricht",
      rating: 5,
    },
    {
      quote: "Pasten direct in onze ruimte alsof ze er altijd al waren. Dat zegt genoeg.",
      name: "Ruben de Jong",
      city: "Tilburg",
      rating: 5,
    },
    {
      quote: "Het leer is van topkwaliteit. Verzending vroeg wel even geduld.",
      name: "Lotte Smit",
      city: "Breda",
      rating: 4,
    },
  ],
  slaapkamers: [
    {
      quote: "Een complete transformatie van onze slaapkamer. Rustig, warm, tijdloos.",
      name: "Karin Pol",
      city: "Zwolle",
      rating: 5,
    },
    {
      quote: "De kasten zijn een lust voor het oog en de praktische indeling is goed doordacht.",
      name: "Joris Vermeer",
      city: "Apeldoorn",
      rating: 5,
    },
    {
      quote: "Goede prijs-kwaliteit voor dit segment. Aanrader.",
      name: "Femke Bos",
      city: "Arnhem",
      rating: 4,
    },
  ],
  kasten: [
    {
      quote: "Veel opbergruimte zonder dat het zwaar oogt. Mooi staaltje design.",
      name: "Sander Klein",
      city: "Almere",
      rating: 5,
    },
    {
      quote: "De afwerking van de scharnieren en grepen is verfijnd. Dat zie je niet vaak meer.",
      name: "Manon Verhoeven",
      city: "Amersfoort",
      rating: 5,
    },
    {
      quote: "Montage was even puzzelen, maar het eindresultaat is geweldig.",
      name: "Tim Bakker",
      city: "Hoorn",
      rating: 4,
    },
  ],
};

const fallback: Review[] = reviewsByCategory.banken;

export function getReviewsFor(category: string): Review[] {
  return reviewsByCategory[category] ?? fallback;
}
