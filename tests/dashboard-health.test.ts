import { describe, expect, test } from "vitest";
import {
  calculateHomeHealth,
  getDashboardGreeting,
  getDateKey,
} from "../src/features/dashboard/health";

describe("dashboard health", () => {
  test("reports a healthy home when no issue is active", () => {
    expect(
      calculateHomeHealth({
        overdueTasks: 0,
        criticalOverdueTasks: 0,
        openRepairs: 0,
        attentionAssets: 0,
        expiredDocuments: 0,
      }),
    ).toEqual({
      score: 100,
      level: "GOOD",
      label: "Good",
      title: "Everything looks good",
      summary: "No overdue maintenance, open repairs, or expired documents.",
    });
  });

  test("reports issues that need attention", () => {
    const health = calculateHomeHealth({
      overdueTasks: 1,
      criticalOverdueTasks: 0,
      openRepairs: 1,
      attentionAssets: 0,
      expiredDocuments: 1,
    });

    expect(health.level).toBe("NEEDS_ATTENTION");
    expect(health.score).toBe(62);
    expect(health.summary).toBe(
      "1 overdue task, 1 open repair, 1 expired document.",
    );
  });

  test("treats an overdue critical task as critical", () => {
    const health = calculateHomeHealth({
      overdueTasks: 1,
      criticalOverdueTasks: 1,
      openRepairs: 0,
      attentionAssets: 0,
      expiredDocuments: 0,
    });

    expect(health.level).toBe("CRITICAL");
    expect(health.score).toBe(55);
    expect(health.title).toBe("Your home needs attention");
  });

  test("uses the selected home timezone for greetings and date boundaries", () => {
    const instant = new Date("2026-08-04T05:30:00.000Z");

    expect(getDashboardGreeting(instant, "Europe/Paris")).toBe("Good morning");
    expect(getDashboardGreeting(instant, "Pacific/Auckland")).toBe(
      "Good afternoon",
    );
    expect(getDateKey(instant, "America/Los_Angeles")).toBe("2026-08-03");
  });
});
