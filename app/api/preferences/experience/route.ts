import { cookies } from "next/headers";
import { z } from "zod";
import { requireHomeAccess, requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import {
  dashboardWidgetIds,
  getExperiencePreferences,
  mobileWidgetKinds,
  saveExperiencePreferences,
  supportedLocales,
} from "@/src/server/services/experience";

const input = z.object({
  locale: z.enum(supportedLocales),
  dashboardWidgets: z
    .array(z.enum(dashboardWidgetIds))
    .min(1)
    .max(dashboardWidgetIds.length)
    .transform((items) => [...new Set(items)]),
  mobileWidget: z.object({
    kind: z.enum(mobileWidgetKinds),
    homeId: z.string().uuid().optional(),
    quickAction: z.enum(["SCAN", "MAINTENANCE", "REPAIR", "CALENDAR"]).optional(),
  }),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    return Response.json({
      preferences: await getExperiencePreferences(session.user.id),
      supportedLocales,
      dashboardWidgetIds,
      mobileWidgetKinds,
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const body = input.parse(await request.json());
    if (body.mobileWidget.homeId)
      await requireHomeAccess(body.mobileWidget.homeId);
    const saved = await saveExperiencePreferences(session.user.id, body);
    (await cookies()).set("homi-locale", body.locale, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return Response.json({ preferences: saved, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
