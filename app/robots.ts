import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://mokkahome.nl";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/checkout",
          "/cart",
          // Oude querystring-filters niet indexeren (vervangen door /<categorie>)
          "/products?",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
