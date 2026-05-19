import { prisma } from "@/lib/prisma";
import LookbookClient from "./LookbookClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lookbook — Mokka Home Interior",
  description: "Editorial blik op de Voorjaar 2026 collectie — horizontaal door de stukken.",
};

async function getLookbookProducts() {
  try {
    return await prisma.product.findMany({
      where: { featured: true, hidden: false, deletedAt: null },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export default async function LookbookPage() {
  const products = await getLookbookProducts();
  return <LookbookClient products={products} />;
}
