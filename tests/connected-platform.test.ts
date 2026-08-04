import { describe, expect, it } from "vitest";
import { getDictionary } from "@/src/features/i18n/dictionaries";
import {
  constantTimeTokenMatch,
  createOpaqueToken,
  hashToken,
  validateWebhookUrl,
} from "@/src/features/integrations/security";

describe("connected platform primitives", () => {
  it("creates opaque API tokens and only matches their hash", () => {
    const generated = createOpaqueToken("api");
    expect(generated.token).toMatch(
      /^homi_api_[a-f0-9]{8}_[A-Za-z0-9_-]+$/u,
    );
    expect(generated.hash).toBe(hashToken(generated.token));
    expect(constantTimeTokenMatch(generated.token, generated.hash)).toBe(true);
    expect(constantTimeTokenMatch(`${generated.token}x`, generated.hash)).toBe(
      false,
    );
  });

  it("creates distinct private calendar tokens", () => {
    const first = createOpaqueToken("calendar");
    const second = createOpaqueToken("calendar");
    expect(first.token).toMatch(/^homi_calendar_/u);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).not.toBe(second.hash);
  });

  it("allows public HTTPS webhooks and blocks local network destinations", () => {
    expect(validateWebhookUrl("https://automation.example.com/homi")).toBe(
      "https://automation.example.com/homi",
    );
    expect(() => validateWebhookUrl("http://example.com/homi")).toThrow(
      "HTTPS",
    );
    expect(() => validateWebhookUrl("https://localhost/homi")).toThrow(
      "private network",
    );
    expect(() => validateWebhookUrl("https://192.168.1.10/homi")).toThrow(
      "private network",
    );
  });

  it("ships navigation labels in English, French and German", () => {
    expect(getDictionary("en").settings).toBe("Settings");
    expect(getDictionary("fr").settings).toBe("Réglages");
    expect(getDictionary("de").settings).toBe("Einstellungen");
  });
});
