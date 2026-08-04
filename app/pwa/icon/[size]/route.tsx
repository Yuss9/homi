import { ImageResponse } from "next/og";

export const runtime = "edge";

const glyphs: Record<string, string> = {
  scan: "⌗",
  maintenance: "✓",
  repair: "⚒",
  calendar: "31",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const requested = Number((await params).size);
  const size = requested === 192 ? 192 : 512;
  const url = new URL(request.url);
  const glyph = glyphs[url.searchParams.get("glyph") ?? ""] ?? "⌂";
  const maskable = url.searchParams.get("maskable") === "1";
  const inset = maskable ? Math.round(size * 0.16) : Math.round(size * 0.06);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f6f8",
          padding: inset,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: Math.round(size * 0.24),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(145deg, #267b5c, #174d3a)",
            color: "white",
            fontSize: glyph === "31" ? Math.round(size * 0.32) : Math.round(size * 0.48),
            fontWeight: 800,
            letterSpacing: "-0.04em",
            boxShadow: `0 ${Math.round(size * 0.04)}px ${Math.round(size * 0.12)}px rgba(22, 48, 38, .24)`,
          }}
        >
          {glyph}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
