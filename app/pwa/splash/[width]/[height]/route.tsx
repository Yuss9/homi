import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ width: string; height: string }> },
) {
  const raw = await params;
  const width = Math.min(3000, Math.max(320, Number(raw.width) || 1179));
  const height = Math.min(3000, Math.max(568, Number(raw.height) || 2556));
  const icon = Math.round(Math.min(width, height) * 0.28);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f6f8",
          color: "#173f31",
          fontFamily: "sans-serif",
          gap: Math.round(icon * 0.22),
        }}
      >
        <div
          style={{
            width: icon,
            height: icon,
            borderRadius: Math.round(icon * 0.24),
            background: "linear-gradient(145deg, #267b5c, #174d3a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: Math.round(icon * 0.52),
            fontWeight: 800,
            boxShadow: `0 ${Math.round(icon * 0.08)}px ${Math.round(icon * 0.24)}px rgba(22, 48, 38, .2)`,
          }}
        >
          ⌂
        </div>
        <div style={{ fontSize: Math.round(icon * 0.25), fontWeight: 800 }}>
          Homi
        </div>
        <div style={{ fontSize: Math.round(icon * 0.095), color: "#60726b" }}>
          Your home, remembered
        </div>
      </div>
    ),
    { width, height },
  );
}
