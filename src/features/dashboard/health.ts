export type HomeHealthLevel = "GOOD" | "NEEDS_ATTENTION" | "CRITICAL";

export type HomeHealthSignals = {
  overdueTasks: number;
  criticalOverdueTasks: number;
  openRepairs: number;
  attentionAssets: number;
  expiredDocuments: number;
};

export type HomeHealth = {
  score: number;
  level: HomeHealthLevel;
  label: string;
  title: string;
  summary: string;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function calculateHomeHealth(signals: HomeHealthSignals): HomeHealth {
  const nonCriticalOverdue = Math.max(
    0,
    signals.overdueTasks - signals.criticalOverdueTasks,
  );
  const penalty =
    Math.min(signals.criticalOverdueTasks * 45, 70) +
    Math.min(nonCriticalOverdue * 18, 36) +
    Math.min(signals.openRepairs * 14, 42) +
    Math.min(signals.attentionAssets * 10, 30) +
    Math.min(signals.expiredDocuments * 6, 18);
  const score = Math.max(0, 100 - penalty);
  const hasIssues =
    signals.overdueTasks > 0 ||
    signals.openRepairs > 0 ||
    signals.attentionAssets > 0 ||
    signals.expiredDocuments > 0;

  const level: HomeHealthLevel =
    signals.criticalOverdueTasks > 0 || score < 60
      ? "CRITICAL"
      : hasIssues
        ? "NEEDS_ATTENTION"
        : "GOOD";

  if (level === "GOOD") {
    return {
      score,
      level,
      label: "Good",
      title: "Everything looks good",
      summary: "No overdue maintenance, open repairs, or expired documents.",
    };
  }

  const issues = [
    signals.overdueTasks
      ? plural(signals.overdueTasks, "overdue task")
      : null,
    signals.openRepairs ? plural(signals.openRepairs, "open repair") : null,
    signals.attentionAssets
      ? plural(signals.attentionAssets, "asset needing attention", "assets needing attention")
      : null,
    signals.expiredDocuments
      ? plural(signals.expiredDocuments, "expired document")
      : null,
  ].filter((issue): issue is string => Boolean(issue));

  return {
    score,
    level,
    label: level === "CRITICAL" ? "Critical" : "Needs attention",
    title:
      level === "CRITICAL"
        ? "Your home needs attention"
        : "A few things need attention",
    summary: `${issues.join(", ")}.`,
  };
}

export function getDashboardGreeting(date: Date, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(date),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
