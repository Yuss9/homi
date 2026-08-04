import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { calendarFeeds } from "@/db/connected-platform-schema";
import { homeMembers } from "@/db/schema";
import { getEnv } from "@/src/server/env";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { buildHomeCalendar } from "@/src/server/integrations/ics";
import { hashToken } from "@/src/server/integrations/tokens";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const id = requestId(request);
  try {
    const token = (await params).token;
    if (!token.startsWith("homi_calendar_"))
      throw new AppError("NOT_FOUND", "Calendar feed not found.", 404);
    const [feed] = await db
      .select({
        id: calendarFeeds.id,
        homeId: calendarFeeds.homeId,
        userId: calendarFeeds.userId,
      })
      .from(calendarFeeds)
      .innerJoin(
        homeMembers,
        and(
          eq(homeMembers.homeId, calendarFeeds.homeId),
          eq(homeMembers.userId, calendarFeeds.userId),
        ),
      )
      .where(
        and(
          eq(calendarFeeds.tokenHash, hashToken(token)),
          isNull(calendarFeeds.revokedAt),
        ),
      )
      .limit(1);
    if (!feed) throw new AppError("NOT_FOUND", "Calendar feed not found.", 404);
    await db
      .update(calendarFeeds)
      .set({ lastUsedAt: new Date() })
      .where(eq(calendarFeeds.id, feed.id));
    const calendar = await buildHomeCalendar(
      feed.homeId,
      getEnv().NEXT_PUBLIC_APP_URL,
    );
    return new Response(calendar, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="homi-calendar.ics"',
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
        "x-request-id": id,
      },
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
