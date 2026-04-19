import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "diaksxzey";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function imgs(folderSlug: string, count: number = 6): string {
  // Genereer Cloudinary URLs — foto's zijn genaamd 01.jpg, 02.jpg, ...
  const arr = [];
  for (let i = 1; i <= count; i++) {
    arr.push(`https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/mokka/banken/${folderSlug}/${String(i).padStart(2, "0")}.jpg`);
  }
  return JSON.stringify(arr);
}

const products = [
  // ── BANKEN ──
  { name: "Armoni Bankstel", description: "Het Armoni bankstel combineert hedendaags comfort met een verfijnd design. De brede armleuningen en diepe zitting nodigen uit tot ontspannen. Verkrijgbaar als complete set.", price: 2899, category: "banken", featured: true, images: imgs("armoni-sofa-set") },
  { name: "Aspendos Hoekbank Goud", description: "De Aspendos hoekbank met gouden accenten biedt royale zitruimte voor het hele gezin. Het luxe frame en de zachte bekleding maken dit een echte blikvanger.", price: 3499, category: "banken", featured: false, images: imgs("aspendos-corner-set-gold") },
  { name: "Aspendos Bankstel Chroom", description: "De Aspendos met chromen onderstel straalt moderne elegantie uit. De strakke lijnen en neutrale tinten passen in elk hedendaags interieur.", price: 2799, category: "banken", featured: false, images: imgs("aspendos-sofa-set-crom") },
  { name: "Aspendos Bankstel Goud", description: "De Aspendos in gouden uitvoering voegt een vleugje glamour toe aan je woonkamer. Premium materialen en een tijdloos silhouet.", price: 2999, category: "banken", featured: true, images: imgs("aspendos-sofa-set-gold") },
  { name: "Belize Bankstel", description: "Het Belize bankstel is ontworpen voor ultiem comfort. De zachte vulling en brede zitting maken lange avonden op de bank onvergetelijk.", price: 2199, category: "banken", featured: false, images: imgs("belize-sofa-set") },
  { name: "Belize Bankstel II", description: "De tweede uitvoering van het populaire Belize model met een vernieuwd design en verbeterde ergonomie voor dagelijks zitcomfort.", price: 2399, category: "banken", featured: false, images: imgs("belize-sofa-set-2") },
  { name: "Canyon Hoekbank", description: "De Canyon hoekbank biedt genereuze zitruimte in een compact formaat. Ideaal voor grotere woonkamers die vragen om een statement meubel.", price: 3199, category: "banken", featured: false, images: imgs("canyon-corner-set") },
  { name: "Canyon Bankstel", description: "Het Canyon bankstel combineert robuuste vormen met zachte materialen. Een stoere maar comfortabele keuze voor het moderne interieur.", price: 2599, category: "banken", featured: false, images: imgs("canyon-sofa-set") },
  { name: "Clara Bankstel", description: "Clara straalt rust en elegantie uit met haar klassieke lijnen en tijdloze uitstraling. De perfecte bank voor wie subtiele luxe waardeert.", price: 2449, category: "banken", featured: true, images: imgs("clara-sofa-set") },
  { name: "Dior Bankstel Goud", description: "Het Dior bankstel in gouden uitvoering is puur vakmanschap. Geïnspireerd door haute couture met een oog voor elk detail.", price: 3299, category: "banken", featured: true, images: imgs("dior-sofa-set-gold") },
  { name: "Dior Bankstel Grijs", description: "De Dior in elegant grijs past moeiteloos in zowel klassieke als moderne interieurs. Dezelfde premium kwaliteit in een ingetogen kleurstelling.", price: 3099, category: "banken", featured: false, images: imgs("dior-sofa-set-grey") },
  { name: "Elano Bankstel", description: "De Elano biedt een perfecte balans tussen stijl en functionaliteit. Het compacte design maakt hem geschikt voor zowel ruime als kleinere woonkamers.", price: 1999, category: "banken", featured: false, images: imgs("elano-sofa-set") },
  { name: "Jesse Bankstel", description: "Het Jesse bankstel kenmerkt zich door zijn lage, uitnodigende zitting en brede armleuningen. Modern en comfortabel voor het hedendaagse huis.", price: 2349, category: "banken", featured: false, images: imgs("jesse-sofa-set") },
  { name: "Jesse Bankstel Bruin", description: "De Jesse in warm bruin creëert direct een huiselijke sfeer. De rijke kleur en zachte stof nodigen uit tot urenlang relaxen.", price: 2349, category: "banken", featured: false, images: imgs("jesse-sofa-set-brown") },
  { name: "Latte Bankstel", description: "Het Latte bankstel in zijn zachte, neutrale tint past bij elke woonstijl. De naam zegt het al: warm, uitnodigend en troostrijk.", price: 2149, category: "banken", featured: false, images: imgs("latte-sofa-set") },
  { name: "Loris Bankstel Bruin", description: "De Loris in rijk bruin straalt warmte en karakter uit. Het royale formaat en de diepe kussens maken dit een bank om in te verdwijnen.", price: 2699, category: "banken", featured: false, images: imgs("loris-sofa-set-brown") },
  { name: "Loris Bankstel Crème", description: "De Loris in crème is licht, fris en elegant. Perfect voor wie een luchtige, ruime uitstraling zoekt in de woonkamer.", price: 2699, category: "banken", featured: true, images: imgs("loris-sofa-set-cream") },
  { name: "Lucas Bankstel Goud", description: "Het Lucas bankstel met gouden accenten is een statement van luxe. De weelderige bekleding en verfijnde details maken het uniek.", price: 2899, category: "banken", featured: false, images: imgs("lucas-sofa-set-gold") },
  { name: "Milano Bankstel Bruin", description: "De Milano in bruin brengt Italiaanse elegantie naar je woonkamer. Strakke lijnen gecombineerd met warme, aardse tinten.", price: 2549, category: "banken", featured: false, images: imgs("milano-sfoa-set-brown") },
  { name: "Milano Bankstel Grijs", description: "De Milano in grijs is de perfecte mix van modern en tijdloos. Een veelzijdig bankstel dat zich aanpast aan elk interieur.", price: 2549, category: "banken", featured: false, images: imgs("milano-sfoa-set-grey") },
  { name: "Mirage Bankstel Brons", description: "Het Mirage bankstel in brons creëert een warm, luxueus gevoel. De metaalachtige accenten geven het een uniek, eigentijds karakter.", price: 3199, category: "banken", featured: true, images: imgs("mirage-sofa-set-bronz") },
  { name: "Mirage Bankstel Goud", description: "De Mirage in goud is pure glamour. Een bankstel dat de aandacht trekt en tegelijkertijd uitnodigt tot comfort.", price: 3399, category: "banken", featured: false, images: imgs("mirage-sofa-set-gold") },
  { name: "Montel Bankstel", description: "Het Montel bankstel is ontworpen voor het dagelijks leven. Duurzaam, comfortabel en met een stijlvol design dat jaren meegaat.", price: 2299, category: "banken", featured: false, images: imgs("montel-sofa-set") },
  { name: "Monza Bankstel Bruin", description: "De Monza in bruin combineert sportieve elegantie met ultiem zitcomfort. Geïnspireerd door Italiaans design met een modern randje.", price: 2749, category: "banken", featured: false, images: imgs("monza-sofa-set-brown") },
  { name: "Monza Bankstel Crème", description: "De Monza in crème biedt dezelfde premium kwaliteit in een lichte, verfijnde uitvoering. Perfect voor lichte, ruime interieurs.", price: 2749, category: "banken", featured: false, images: imgs("monza-sofa-set-cream") },
  { name: "Moon Hoekbank", description: "De Moon hoekbank met zijn ronde vormen brengt zachtheid in je woonkamer. Het organische design maakt het een opvallend statement.", price: 3599, category: "banken", featured: true, images: imgs("moon-corner") },
  { name: "Nevada Bankstel", description: "Het Nevada bankstel staat voor robuust comfort. De stevige constructie en brede zitting zijn ideaal voor gezinnen.", price: 2199, category: "banken", featured: false, images: imgs("nevada-sofa-set") },
  { name: "Odessa Hoekbank", description: "De Odessa hoekbank biedt maximale zitruimte met een elegant profiel. De perfecte combinatie van ruimte en stijl.", price: 3399, category: "banken", featured: false, images: imgs("odessa-corner") },
  { name: "Odessa Bankstel Bruin", description: "De Odessa in rijk bruin brengt warmte en verfijning samen. Een klassiek bankstel met moderne comfort.", price: 2899, category: "banken", featured: false, images: imgs("odessa-sofa-set-brown") },
  { name: "Odessa Bankstel Goud", description: "De Odessa in goud is pure luxe voor de veeleisende klant. Elk detail is doordacht, van de naden tot de afwerking.", price: 3099, category: "banken", featured: false, images: imgs("odessa-sofa-set-gold") },
  { name: "Othello Hoekbank Goud", description: "De Othello hoekbank met gouden frame is een meesterwerk van design. Royale afmetingen en een luxueuze uitstraling.", price: 3699, category: "banken", featured: false, images: imgs("othello-corner-set-gold") },
  { name: "Othello Bankstel Goud", description: "Het Othello bankstel combineert klassieke vormen met luxe materialen. Het gouden onderstel geeft het een koninklijk karakter.", price: 3299, category: "banken", featured: false, images: imgs("othello-sofa-set-gold") },
  { name: "Rixos Bankstel", description: "Het Rixos bankstel biedt resort-achtig comfort voor thuis. Ruime zitting, zachte kussens en een ontspannen uitstraling.", price: 2449, category: "banken", featured: false, images: imgs("rixsos-sofa-set") },
  { name: "Rixos Bankstel II", description: "De tweede versie van het Rixos met een vernieuwd design. Dezelfde premium kwaliteit in een frisse uitvoering.", price: 2649, category: "banken", featured: false, images: imgs("rixsos-sofa-set-2") },
  { name: "Romance Concept Set", description: "De Romance Concept set is ontworpen voor wie romantiek en elegantie zoekt. Zachte curves en luxe materialen creëren een droomachtige sfeer.", price: 3499, category: "banken", featured: true, images: imgs("romance-concept-set") },
  { name: "Romeo Bankstel", description: "Het Romeo bankstel is een tijdloze klassieker. De verfijnde lijnen en premium bekleding maken het een bank voor generaties.", price: 2599, category: "banken", featured: false, images: imgs("romeo-sofa-set") },
  { name: "Royal Hoekbank Goud", description: "De Royal hoekbank met gouden accenten biedt koninklijk zitcomfort. Een imposant meubelstuk dat je woonkamer transformeert.", price: 3899, category: "banken", featured: false, images: imgs("royal-corner-set-gold") },
  { name: "Royal Bankstel Beige", description: "Het Royal bankstel in beige straalt sereniteit en klasse uit. De neutrale tint combineert moeiteloos met elke woonstijl.", price: 2999, category: "banken", featured: false, images: imgs("royal-sofa-set-bej") },
  { name: "Royal Bankstel Chroom", description: "De Royal in chromen uitvoering is modern en gedurfd. Het glanzende onderstel geeft het een eigentijdse twist.", price: 3099, category: "banken", featured: false, images: imgs("royal-sofa-set-crom") },
  { name: "Teddy Hoekbank", description: "De Teddy hoekbank met zijn zachte, teddy-achtige stof is onweerstaanbaar comfortabel. Een knusse toevoeging aan elke woonkamer.", price: 2999, category: "banken", featured: false, images: imgs("teddy-corner-set") },
  { name: "Tilda Bankstel Beige", description: "Het Tilda bankstel in beige biedt Scandinavisch geïnspireerd comfort. Clean design, zachte materialen en een uitnodigende zitting.", price: 2199, category: "banken", featured: false, images: imgs("tilda-sofa-set-bej") },
  { name: "Tilda Bankstel Grijs", description: "De Tilda in grijs is de ideale bank voor het moderne interieur. Strak, comfortabel en tijdloos in zijn eenvoud.", price: 2199, category: "banken", featured: false, images: imgs("tilda-sofa-set-grey") },

  // ── PLACEHOLDER CATEGORIEËN (worden later vervangen door echte producten) ──
  { name: "Slaapkamer Product 1", description: "Tijdelijk product — wordt later aangevuld.", price: 1299, category: "slaapkamers", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800"]) },
  { name: "Slaapkamer Product 2", description: "Tijdelijk product — wordt later aangevuld.", price: 899, category: "slaapkamers", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800"]) },
  { name: "Kast Product 1", description: "Tijdelijk product — wordt later aangevuld.", price: 749, category: "kasten", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800"]) },
  { name: "Kast Product 2", description: "Tijdelijk product — wordt later aangevuld.", price: 599, category: "kasten", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800"]) },
  { name: "Tafel Product 1", description: "Tijdelijk product — wordt later aangevuld.", price: 999, category: "tafels", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800"]) },
  { name: "Tafel Product 2", description: "Tijdelijk product — wordt later aangevuld.", price: 649, category: "tafels", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800"]) },
  { name: "Stoel Product 1", description: "Tijdelijk product — wordt later aangevuld.", price: 449, category: "stoelen", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800"]) },
  { name: "Stoel Product 2", description: "Tijdelijk product — wordt later aangevuld.", price: 349, category: "stoelen", featured: false, images: JSON.stringify(["https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800"]) },
];

async function main() {
  console.log("Database vullen...");
  await prisma.product.deleteMany();
  for (const product of products) {
    await prisma.product.create({
      data: { ...product, slug: slugify(product.name) },
    });
  }
  const banken = products.filter(p => p.category === "banken").length;
  const featured = products.filter(p => p.featured).length;
  console.log(`${products.length} producten toegevoegd (${banken} banken, ${featured} uitgelicht).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
