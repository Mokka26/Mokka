import type { MetadataRoute } from "next";
import { businessInfo } from "@/lib/business-info";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/checkout", "/cart"],
      },
    ],
    sitemap: `${businessInfo.siteUrl}/sitemap.xml`,
  };
}
