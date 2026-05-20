import { ImageResponse } from "next/og";
import { businessInfo } from "@/lib/business-info";

// Standaard OG image voor home + statische routes.
// Per-categorie en per-product OG images leven in hun eigen route-files.

export const runtime = "edge";
export const alt = "Mokka Home Interior";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function HomeOpengraphImage() {
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
              marginBottom: 24,
            }}
          >
            {businessInfo.name}
          </div>
          <div
            style={{
              fontSize: 96,
              lineHeight: 1,
              color: "#14110D",
              letterSpacing: "-0.025em",
              maxWidth: 900,
            }}
          >
            Meubels met een ziel
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#5A5854",
            fontSize: 22,
          }}
        >
          <span>{businessInfo.address.city} · {businessInfo.foundingYear}</span>
          <span style={{ color: "#B96B4C" }}>mokkahome.nl</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
