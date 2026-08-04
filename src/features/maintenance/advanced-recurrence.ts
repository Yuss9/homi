import { addDays, addMonths } from "date-fns";
import {
  calculateNextDueDate,
  type Frequency,
} from "@/src/features/maintenance/recurrence";
import type { AdvancedRecurrenceRule } from "@/db/maintenance-operations-schema";

const seasonMonths: Record<NonNullable<AdvancedRecurrenceRule["season"]>, number[]> = {
  SPRING: [2, 3, 4],
  SUMMER: [5, 6, 7],
  AUTUMN: [8, 9, 10],
  WINTER: [11, 0, 1],
};

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function parseBoundary(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function applyDayOfMonth(candidate: Date, completedAt: Date, day: number) {
  const safeDay = Math.min(31, Math.max(1, day));
  let month = candidate.getUTCMonth();
  let year = candidate.getUTCFullYear();
  const resolve = () => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(safeDay, lastDay)));
  };
  let next = resolve();
  if (next.getTime() <= completedAt.getTime()) {
    const following = addMonths(new Date(Date.UTC(year, month, 1)), 1);
    month = following.getUTCMonth();
    year = following.getUTCFullYear();
    next = resolve();
  }
  return next;
}

export function calculateAdvancedNextDueDate(
  completedAt: Date,
  frequency: Frequency,
  interval: number,
  rule?: AdvancedRecurrenceRule | null,
): Date | null {
  if (!rule || Object.keys(rule).length === 0) {
    return calculateNextDueDate(completedAt, frequency, interval);
  }

  const customDays = Number(rule.custom?.intervalDays ?? 0);
  let candidate =
    Number.isInteger(customDays) && customDays > 0
      ? addDays(completedAt, customDays)
      : calculateNextDueDate(completedAt, frequency, interval);
  if (!candidate) return null;
  candidate = startOfUtcDay(candidate);

  const startDate = parseBoundary(rule.startDate);
  const endDate = parseBoundary(rule.endDate);
  if (startDate && candidate < startDate) candidate = startDate;

  if (rule.dayOfMonth) {
    candidate = applyDayOfMonth(candidate, completedAt, rule.dayOfMonth);
  }

  const allowedMonths = new Set([
    ...(rule.months ?? []).map((month) => month - 1),
    ...(rule.season ? seasonMonths[rule.season] : []),
  ]);
  const allowedWeekdays = new Set(rule.weekdays ?? []);

  for (let attempts = 0; attempts < 1100; attempts += 1) {
    const monthMatches =
      allowedMonths.size === 0 || allowedMonths.has(candidate.getUTCMonth());
    const weekdayMatches =
      allowedWeekdays.size === 0 ||
      allowedWeekdays.has(candidate.getUTCDay());
    if (monthMatches && weekdayMatches) break;
    candidate = addDays(candidate, 1);
  }

  if (endDate && candidate > endDate) return null;
  return candidate;
}
