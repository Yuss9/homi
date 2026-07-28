import { describe, expect, it } from "vitest";
import {
  calculateNextDueDate,
  isDue,
  isOverdue,
} from "../src/features/maintenance/recurrence";
describe("recurring maintenance dates", () => {
  it("returns no next date for one-time work", () =>
    expect(
      calculateNextDueDate(new Date("2026-01-10T10:00:00Z"), "ONCE", 1),
    ).toBeNull());
  it("adds daily and weekly intervals", () => {
    expect(
      calculateNextDueDate(
        new Date("2026-01-10T10:00:00Z"),
        "DAILY",
        3,
      )?.toISOString(),
    ).toBe("2026-01-13T10:00:00.000Z");
    expect(
      calculateNextDueDate(
        new Date("2026-01-10T10:00:00Z"),
        "WEEKLY",
        2,
      )?.toISOString(),
    ).toBe("2026-01-24T10:00:00.000Z");
  });
  it("handles calendar month ends safely", () =>
    expect(
      calculateNextDueDate(
        new Date("2025-01-31T08:00:00Z"),
        "MONTHLY",
        1,
      )?.toISOString(),
    ).toBe("2025-02-28T08:00:00.000Z"));
  it("handles leap years for yearly schedules", () =>
    expect(
      calculateNextDueDate(
        new Date("2024-02-29T08:00:00Z"),
        "YEARLY",
        1,
      )?.toISOString(),
    ).toBe("2025-02-28T08:00:00.000Z"));
  it("rejects unsafe intervals", () =>
    expect(() => calculateNextDueDate(new Date(), "CUSTOM", 0)).toThrow(
      /interval/i,
    ));
  it("detects overdue tasks", () =>
    expect(isOverdue(new Date("2026-01-01"), new Date("2026-01-02"))).toBe(
      true,
    ));
  it("only allows completion when the due time has arrived", () => {
    const now = new Date("2026-01-02T10:00:00Z");
    expect(isDue(new Date("2026-01-02T09:59:59Z"), now)).toBe(true);
    expect(isDue(new Date("2026-01-02T10:00:00Z"), now)).toBe(true);
    expect(isDue(new Date("2026-01-02T10:00:01Z"), now)).toBe(false);
  });
});
