import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ width: string; height: string }> },
) {
  const raw = await params;
  const width = Math.min(1600, Math.max(320, Number(raw.width) || 390));
  const height = Math.min(1600, Math.max(568, Number(raw.height) || 844));
  const narrow = width < 700;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f4f6f8",
          color: "#18201d",
          fontFamily: "sans-serif",
          padding: narrow ? 26 : 42,
          gap: narrow ? 18 : 30,
          flexDirection: narrow ? "column" : "row",
        }}
      >
        {!narrow && (
          <div
            style={{
              width: 230,
              borderRadius: 28,
              background: "#173f31",
              color: "white",
              display: "flex",
              flexDirection: "column",
              padding: 28,
              gap: 22,
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 800 }}>⌂ Homi</div>
            {[
              "Overview",
              "Calendar",
              "Assets",
              "Maintenance",
              "Repairs",
              "Documents",
            ].map((item) => (
              <div key={item} style={{ fontSize: 18, opacity: 0.9 }}>
                {item}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: narrow ? 18 : 26,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: narrow ? 18 : 22, color: "#597069" }}>
                Your home, remembered
              </div>
              <div style={{ fontSize: narrow ? 38 : 54, fontWeight: 800 }}>
                Good morning.
              </div>
            </div>
            <div style={{ fontSize: 30 }}>⌂</div>
          </div>
          <div
            style={{
              borderRadius: 28,
              background: "#dcece5",
              padding: narrow ? 22 : 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: narrow ? 25 : 34, fontWeight: 750 }}>
                Everything looks good
              </div>
              <div style={{ fontSize: narrow ? 16 : 20, marginTop: 8 }}>
                Home Health · Good · 96/100
              </div>
            </div>
            <div style={{ fontSize: narrow ? 38 : 54 }}>✓</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: narrow ? "column" : "row",
              gap: narrow ? 16 : 22,
              flex: 1,
            }}
          >
            {[
              ["Coming up", "Change ventilation filter", "Tomorrow"],
              ["At a glance", "18 assets · 6 tasks", "2 documents expire soon"],
            ].map(([title, line, meta]) => (
              <div
                key={title}
                style={{
                  flex: 1,
                  background: "white",
                  borderRadius: 26,
                  padding: narrow ? 22 : 30,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  boxShadow: "0 16px 40px rgba(32, 45, 40, .08)",
                }}
              >
                <div style={{ fontSize: narrow ? 23 : 30, fontWeight: 750 }}>
                  {title}
                </div>
                <div style={{ fontSize: narrow ? 18 : 22 }}>{line}</div>
                <div style={{ color: "#697b74", fontSize: narrow ? 15 : 18 }}>
                  {meta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width, height },
  );
}
