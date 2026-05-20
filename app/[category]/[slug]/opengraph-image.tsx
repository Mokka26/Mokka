import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { firstImageUrl } from "@/lib/imageHelpers";
import { cldOptimize } from "@/lib/cloudinary-url";
import { businessInfo } from "@/lib/business-info";

export const runtime = "edge";
export const alt = "Product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProductOpengraphImage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  const product = await prisma.product.findFirst({
    where: { slug: params.slug, deletedAt: null },
    select: { name: true, price: true, images: true, category: true },
  });

  if (!product) {
    return new ImageResponse(<div>Mokka Home</div>, { ...size });
  }

  const heroUrl = firstImageUrl(product.images);
  const optimized = heroUrl
    ? cldOptimize(heroUrl, { ar: "3:2", w: 1200, mode: "fill", quality: "auto:best" })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F4F0E8",
          fontFamily: "serif",
        }}
      >
        {/* Linker helft: tekst */}
        <div
          style={{
            width: "50%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 16,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "#B96B4C",
                marginBottom: 24,
              }}
            >
              {businessInfo.name}
            </div>
            <div
              style={{
                fontSize: 64,
                lineHeight: 1.05,
                color: "#14110D",
                letterSpacing: "-0.025em",
              }}
            >
              {product.name}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 44,
                color: "#B96B4C",
                marginBottom: 16,
              }}
            >
              €{product.price.toFixed(0)},-
            </div>
            <div
              style={{
                fontSize: 18,
                color: "#5A5854",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              mokkahome.nl/{params.category}
            </div>
          </div>
        </div>

        {/* Rechter helft: product image */}
        {optimized && (
          <div
            style={{
              width: "50%",
              display: "flex",
              backgroundImage: `url(${optimized})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
      </div>
    ),
    { ...size },
  );
}
