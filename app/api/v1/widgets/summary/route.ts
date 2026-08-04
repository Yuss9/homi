import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  experiencePreferences,
  type MobileWidgetKind,
} from "@/db/connected-platform-schema";
import { homeMembers } from "@/db/schema";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { getConnectedHomeSummary } from "@/src/server/integrations/home-summary";
import {
  authenticateApiKey,
  requireApiHomeAccess,
} from "@/src/server/integrations/tokens";

const kinds = [
  "NEXT_MAINTENANCE",
  "HOME_HEALTH",
  "OPEN_REPAIRS",
  "MONTHLY_COSTS",
  "QUICK_ACTION",
] as const satisfies readonly MobileWidgetKind[];

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const auth = await authenticateApiKey(request, "widgets:read");
    const url = new URL(request.url);
    const requestedHomeId = url.searchParams.get("homeId");
    const requestedKind = url.searchParams.get("kind");

    const [preferences] = await db
      .select()
      .from(experiencePreferences)
      .where(eq(experiencePreferences.userId, auth.userId))
      .limit(1);
    const memberships = await db
      .select({ homeId: homeMembers.homeId })
      .from(homeMembers)
      .where(eq(homeMembers.userId, auth.userId))
      .orderBy(asc(homeMembers.joinedAt));

    const homeId =
      (requestedHomeId
        ? z.string().uuid().parse(requestedHomeId)
        : preferences?.mobileWidget.homeId) ?? memberships[0]?.homeId;
    if (!homeId)
      throw new AppError("NOT_FOUND", "No accessible home is available.", 404);
    await requireApiHomeAccess(auth.userId, homeId);

    const kind = requestedKind
      ? z.enum(kinds).parse(requestedKind)
      : (preferences?.mobileWidget.kind ?? "NEXT_MAINTENANCE");
    const summary = await getConnectedHomeSummary(homeId);
    const quickAction =
      preferences?.mobileWidget.quickAction ?? "MAINTENANCE";

    const data =
      kind === "HOME_HEALTH"
        ? {
            title: summary.health.label,
            value: `${summary.health.score}/100`,
            subtitle: summary.health.summary,
            url: "/dashboard",
          }
        : kind === "OPEN_REPAIRS"
          ? {
              title: "Open repairs",
              value: String(summary.metrics.openRepairs),
              subtitle:
                summary.openRepairItems[0]?.title ?? "No open repair",
              url: "/repairs",
            }
          : kind === "MONTHLY_COSTS"
            ? {
                title: "Costs this month",
                value: new Intl.NumberFormat("en", {
                  style: "currency",
                  currency: summary.home.currency,
                }).format(summary.metrics.monthlyCosts),
                subtitle: summary.home.name,
                url: "/costs",
              }
            : kind === "QUICK_ACTION"
              ? {
                  title: "Quick action",
                  value: quickAction.replaceAll("_", " ").toLowerCase(),
                  subtitle: summary.home.name,
                  url:
                    quickAction === "SCAN"
                      ? summary.quickActions.scan
                      : quickAction === "REPAIR"
                        ? summary.quickActions.createRepair
                        : quickAction === "CALENDAR"
                          ? summary.quickActions.calendar
                          : summary.quickActions.createMaintenance,
                }
              : {
                  title: "Next maintenance",
                  value:
                    summary.upcomingMaintenance[0]?.title ?? "Nothing scheduled",
                  subtitle: summary.upcomingMaintenance[0]?.nextDueAt ?? summary.home.name,
                  url: summary.upcomingMaintenance[0]?.url ?? "/maintenance",
                };

    return Response.json({
      widget: {
        kind,
        home: summary.home,
        data,
        refreshedAt: summary.generatedAt,
      },
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
