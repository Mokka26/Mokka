import type { CategorySlug } from "@/lib/categories";

// Homepage "Kamer voor kamer": één sfeerbeeld per kamer (AI-sfeerbeelden die
// ook foto 1 van het product zijn) met een korte tekst en een link naar de
// categorie. Aantallen komen live uit getProductCounts().
export interface HomeRoom {
  key: string;
  category: CategorySlug;
  room: string;
  title: string;
  text: string;
  cta: string;
  image: string;
  alt: string;
}

/** Vaste tegelfoto's voor CategoriesGrid waar de automatische keuze minder
 *  mooi is (dubbel met de hero, of een close-up met merknaam). Andere
 *  categorieën kiezen zelf de nieuwste sfeerfoto uit de DB. */
export const CATEGORY_TILE_IMAGES: Partial<Record<CategorySlug, { url: string; productName: string }>> = {
  banken: {
    url: "https://res.cloudinary.com/diaksxzey/image/upload/v1793233836/mokka/bankstellen/soprano-bank/sfeer-01.jpg",
    productName: "Soprano Bank",
  },
  bedden: {
    url: "https://res.cloudinary.com/diaksxzey/image/upload/v1780263797/mokka/bedden/ow-julie/03.jpg",
    productName: "Julie Boxspring",
  },
};

export const HOME_ROOMS: ReadonlyArray<HomeRoom> = [
  {
    key: "woonkamer",
    category: "banken",
    room: "Woonkamer",
    title: "Van tweezitsbank tot ruime hoekbank",
    text: "Banken, hoekbanken en fauteuils in rustige, warme kleuren. Zit ze eerst proef in onze showroom, of bestel direct online.",
    cta: "Bekijk banken",
    image: "https://res.cloudinary.com/diaksxzey/image/upload/v1793233717/mokka/hoekbanken/nora-hoekbank/sfeer-01.jpg",
    alt: "Woonkamer met de Nora bank in witte bouclé en een ronde houten salontafel",
  },
  {
    key: "eetkamer",
    category: "eettafels",
    room: "Eetkamer",
    title: "Samen aan tafel",
    text: "Ovale, ronde en rechthoekige eettafels, met eetkamerstoelen die erbij passen.",
    cta: "Bekijk eettafels",
    image: "https://res.cloudinary.com/diaksxzey/image/upload/v1793141743/mokka/eettafels/tafel-apollo-180-cm-deens-ovaal-glanzend-steen-shakespear-beige/sfeer-01.jpg",
    alt: "Eetkamer met de ovale Apollo eettafel met beige stenen blad en vier beige stoelen",
  },
  {
    key: "slaapkamer",
    category: "bedden",
    room: "Slaapkamer",
    title: "Rust in de slaapkamer",
    text: "Boxsprings, bedden en complete slaapkamersets, in de showroom te bekijken en uit te proberen.",
    cta: "Bekijk bedden",
    image: "https://res.cloudinary.com/diaksxzey/image/upload/mokka/bedden/vanilla-loop/03_sq.jpg",
    alt: "Lichte slaapkamer met de Vanilla Loop boxspring",
  },
];
