import { ImageResponse } from "next/og";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export default function AppleIcon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", borderRadius: 42, background: "#1d6a4e", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 112, fontWeight: 800 }}>⌂</div>, size);
}

