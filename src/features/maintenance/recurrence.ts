import { addDays, addMonths, addWeeks, addYears, isValid } from "date-fns";

export type Frequency =
  "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

export function calculateNextDueDate(
  completedAt: Date,
  frequency: Frequency,
  interval = 1,
): Date | null {
  if (!isValid(completedAt)) throw new Error("Invalid completion date");
  if (!Number.isInteger(interval) || interval < 1 || interval > 3650)
    throw new Error("Frequency interval must be an integer between 1 and 3650");
  switch (frequency) {
    case "ONCE":
      return null;
    case "DAILY":
      return addDays(completedAt, interval);
    case "WEEKLY":
      return addWeeks(completedAt, interval);
    case "MONTHLY":
      return addMonths(completedAt, interval);
    case "YEARLY":
      return addYears(completedAt, interval);
    case "CUSTOM":
      return addDays(completedAt, interval);
  }
}

export function isOverdue(nextDueAt: Date, now = new Date()) {
  return nextDueAt.getTime() < now.getTime();
}

export function isDue(nextDueAt: Date, now = new Date()) {
  return nextDueAt.getTime() <= now.getTime();
}
