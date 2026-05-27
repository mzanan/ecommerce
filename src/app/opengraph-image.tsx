import { ImageResponse } from "next/og";

export const alt = "NOIRE — Luxury Lingerie Collections";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#d4af37",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
          }}
        >
          ecommerce.itsmatias.com
        </div>
        <div
          style={{
            fontSize: 144,
            fontWeight: 300,
            letterSpacing: "0.08em",
            lineHeight: 1,
            marginTop: 24,
          }}
        >
          NOIRE
        </div>
        <div
          style={{
            fontSize: 44,
            color: "#e5e5e5",
            marginTop: 16,
            fontWeight: 400,
            letterSpacing: "0.04em",
          }}
        >
          Luxury Lingerie Collections
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a3a3a3",
            marginTop: 48,
            maxWidth: 1000,
            lineHeight: 1.35,
          }}
        >
          Premium quality intimate apparel for the modern woman.
        </div>
      </div>
    ),
    { ...size },
  );
}
