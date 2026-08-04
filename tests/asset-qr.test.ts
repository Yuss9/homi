import { describe, expect, test } from "vitest";
import { createQrSvg } from "@/src/features/assets/qr";

describe("asset QR codes", () => {
  test("renders a deterministic private SVG without external content", () => {
    const url = "https://homi.example/assets/123e4567-e89b-12d3-a456-426614174000";
    const first = createQrSvg(url, "Boiler QR code");
    const second = createQrSvg(url, "Boiler QR code");

    expect(first).toBe(second);
    expect(first).toContain('viewBox="0 0 45 45"');
    expect(first).toContain("Boiler QR code");
    expect(first).toContain("<path d=\"");
    expect(first).not.toContain("http://");
    expect(first).not.toContain(url);
  });

  test("rejects payloads that exceed the compact asset code capacity", () => {
    expect(() => createQrSvg(`https://homi.example/${"x".repeat(200)}`)).toThrow(
      /too long/i,
    );
  });
});
