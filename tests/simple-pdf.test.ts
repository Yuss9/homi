import { describe, expect, test } from "vitest";
import { createTextPdf } from "@/src/server/pdf/simple-pdf";

describe("simple PDF reports", () => {
  test("creates a valid multi-page PDF with escaped text", () => {
    const pdf = createTextPdf(
      "Homi (insurance)",
      Array.from({ length: 60 }, (_, index) => `Item ${index + 1} \\ checked`),
    );
    const text = pdf.toString("binary");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Count 2");
    expect(text).toContain("Homi \\(insurance\\)");
    expect(text.endsWith("%%EOF")).toBe(true);
  });
});
