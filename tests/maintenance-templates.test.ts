import { describe, expect, test } from "vitest";
import {
  findSystemMaintenanceTemplate,
  systemMaintenanceTemplates,
} from "@/src/features/maintenance/templates";

describe("maintenance template library", () => {
  test("ships a useful and uniquely addressed system library", () => {
    expect(systemMaintenanceTemplates.length).toBeGreaterThanOrEqual(10);
    expect(new Set(systemMaintenanceTemplates.map((item) => item.id)).size).toBe(
      systemMaintenanceTemplates.length,
    );
    expect(
      new Set(systemMaintenanceTemplates.map((item) => item.category)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(
      systemMaintenanceTemplates.every(
        (item) =>
          item.source === "SYSTEM" &&
          item.frequencyInterval > 0 &&
          item.title.length > 3,
      ),
    ).toBe(true);
  });

  test("resolves a system routine by its stable identifier", () => {
    expect(findSystemMaintenanceTemplate("system:smoke-alarm-test")).toMatchObject(
      {
        title: "Test smoke and carbon monoxide alarms",
        category: "Safety",
        priority: "HIGH",
      },
    );
    expect(findSystemMaintenanceTemplate("system:unknown")).toBeUndefined();
  });
});
