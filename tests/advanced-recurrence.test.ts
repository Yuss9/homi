import { describe, expect, test } from "vitest";
import { calculateAdvancedNextDueDate } from "@/src/features/maintenance/advanced-recurrence";

describe("advanced maintenance recurrence", () => {
  test("moves a monthly task to the next allowed weekday", () => {
    const next = calculateAdvancedNextDueDate(
      new Date("2026-01-01T12:00:00.000Z"),
      "MONTHLY",
      1,
      { weekdays: [1] },
    );
    expect(next?.toISOString()).toBe("2026-02-02T00:00:00.000Z");
  });

  test("supports fixed month days and seasonal windows", () => {
    const fixedDay = calculateAdvancedNextDueDate(
      new Date("2026-01-20T12:00:00.000Z"),
      "MONTHLY",
      1,
      { dayOfMonth: 15 },
    );
    expect(fixedDay?.toISOString()).toBe("2026-02-15T00:00:00.000Z");

    const summer = calculateAdvancedNextDueDate(
      new Date("2026-03-15T12:00:00.000Z"),
      "MONTHLY",
      1,
      { season: "SUMMER" },
    );
    expect(summer?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  test("honors custom day intervals and recurrence end dates", () => {
    const custom = calculateAdvancedNextDueDate(
      new Date("2026-01-01T12:00:00.000Z"),
      "CUSTOM",
      1,
      { custom: { intervalDays: 10 } },
    );
    expect(custom?.toISOString()).toBe("2026-01-11T00:00:00.000Z");

    const ended = calculateAdvancedNextDueDate(
      new Date("2026-01-01T12:00:00.000Z"),
      "MONTHLY",
      1,
      { endDate: "2026-01-15" },
    );
    expect(ended).toBeNull();
  });
});
