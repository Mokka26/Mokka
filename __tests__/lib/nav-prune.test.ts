import { emptyCategoryHrefs, pruneEmptyLinks } from "@/lib/nav-prune";

const items = [
  { label: "Slapen", subLinks: [{ heading: "Bedden", links: [{ label: "Bedden", href: "/bedden" }, { label: "Matrassen", href: "/matrassen" }] }, { heading: "Kasten", links: [{ label: "Nachtkastjes", href: "/nachtkastjes" }] }] },
  { label: "Showroom" },
];

describe("pruneEmptyLinks", () => {
  it("verwijdert lege categorieën en lege groepen", () => {
    const out = pruneEmptyLinks(items, new Set(["/nachtkastjes", "/matrassen"]));
    expect(out[0].subLinks).toEqual([{ heading: "Bedden", links: [{ label: "Bedden", href: "/bedden" }] }]);
    expect(out[1]).toEqual({ label: "Showroom" });
  });
});

describe("emptyCategoryHrefs", () => {
  it("geeft alleen categorieën met 0 producten", () => {
    expect(emptyCategoryHrefs({ bedden: 87, nachtkastjes: 0 }, ["bedden", "nachtkastjes", "ladekasten"])).toEqual(["/nachtkastjes", "/ladekasten"]);
  });
});
