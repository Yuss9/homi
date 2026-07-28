import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const preferenceInput = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  maintenanceReminderDays: z.number().int().min(0).max(90),
  warrantyReminderDays: z.number().int().min(0).max(365),
  documentExpiryReminderDays: z.number().int().min(0).max(365),
  weeklySummaryEnabled: z.boolean(),
  timezone: z.string().trim().min(1).max(80),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.user.id))
      .limit(1);
    return Response.json({ preferences: preferences ?? null, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const input = preferenceInput.parse(await request.json());
    const [preferences] = await db
      .insert(notificationPreferences)
      .values({ ...input, userId: session.user.id })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { ...input, updatedAt: new Date() },
      })
      .returning();
    return Response.json({ preferences, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
