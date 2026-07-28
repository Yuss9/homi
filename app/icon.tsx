import { ImageResponse } from "next/og";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", borderRadius: 9, background: "#1d6a4e", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>⌂</div>, size);
}

