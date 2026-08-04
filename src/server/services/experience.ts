import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  experiencePreferences,
  type DashboardWidgetId,
  type MobileWidgetKind,
} from "@/db/connected-platform-schema";

export const supportedLocales = ["en", "fr", "de"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const dashboardWidgetIds = [
  "health",
  "upcoming",
  "summary",
  "repairs",
  "costs",
] as const satisfies readonly DashboardWidgetId[];

export const mobileWidgetKinds = [
  "NEXT_MAINTENANCE",
  "HOME_HEALTH",
  "OPEN_REPAIRS",
  "MONTHLY_COSTS",
  "QUICK_ACTION",
] as const satisfies readonly MobileWidgetKind[];

export const defaultExperience = {
  locale: "en" as SupportedLocale,
  dashboardWidgets: [...dashboardWidgetIds] as DashboardWidgetId[],
  mobileWidget: { kind: "NEXT_MAINTENANCE" as MobileWidgetKind },
};

export async function getExperiencePreferences(userId: string) {
  const [row] = await db
    .select()
    .from(experiencePreferences)
    .where(eq(experiencePreferences.userId, userId))
    .limit(1);
  return row
    ? {
        locale: supportedLocales.includes(row.locale as SupportedLocale)
          ? (row.locale as SupportedLocale)
          : defaultExperience.locale,
        dashboardWidgets: row.dashboardWidgets,
        mobileWidget: row.mobileWidget,
      }
    : defaultExperience;
}

export async function saveExperiencePreferences(
  userId: string,
  value: {
    locale: SupportedLocale;
    dashboardWidgets: DashboardWidgetId[];
    mobileWidget: {
      kind: MobileWidgetKind;
      homeId?: string;
      quickAction?: "SCAN" | "MAINTENANCE" | "REPAIR" | "CALENDAR";
    };
  },
) {
  const [saved] = await db
    .insert(experiencePreferences)
    .values({ userId, ...value })
    .onConflictDoUpdate({
      target: experiencePreferences.userId,
      set: { ...value, updatedAt: new Date() },
    })
    .returning();
  return saved;
}
