import { ImageResponse } from "next/og";
import { getCategory } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";

export const alt = "Mokka Home — Categorie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function CategoryOpengraphImage({
  params,
}: {
  params: { category: string };
}) {
  const cat = getCategory(params.category);
  if (!cat) {
    return new ImageResponse(<div>Mokka Home</div>, { ...size });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #F4F0E8 0%, #EEEAE3 100%)",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#B96B4C",
              marginBottom: 32,
            }}
          >
            {businessInfo.name} · Collectie
          </div>
          <div
            style={{
              fontSize: 110,
              lineHeight: 0.95,
              color: "#14110D",
              letterSpacing: "-0.025em",
              maxWidth: 1000,
              marginBottom: 32,
            }}
          >
            {cat.label}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#5A5854",
              lineHeight: 1.4,
              maxWidth: 800,
            }}
          >
            {cat.intro}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            color: "#B96B4C",
            fontSize: 22,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          mokkahome.nl/{cat.slug}
        </div>
      </div>
    ),
    { ...size },
  );
}

