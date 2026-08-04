import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calendarFeeds } from "@/db/connected-platform-schema";
import { requireHomeAccess, requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { getEnv } from "@/src/server/env";
import { createOpaqueToken } from "@/src/server/integrations/tokens";

const bodyInput = z.object({ homeId: z.string().uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const homeId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("homeId"));
    await requireHomeAccess(homeId);
    const [feed] = await db
      .select({
        id: calendarFeeds.id,
        tokenPrefix: calendarFeeds.tokenPrefix,
        lastUsedAt: calendarFeeds.lastUsedAt,
        createdAt: calendarFeeds.createdAt,
      })
      .from(calendarFeeds)
      .where(
        and(
          eq(calendarFeeds.userId, session.user.id),
          eq(calendarFeeds.homeId, homeId),
          isNull(calendarFeeds.revokedAt),
        ),
      )
      .limit(1);
    return Response.json({ feed: feed ?? null, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const { homeId } = bodyInput.parse(await request.json());
    await requireHomeAccess(homeId);
    const generated = createOpaqueToken("calendar");
    const [existing] = await db
      .select({ id: calendarFeeds.id })
      .from(calendarFeeds)
      .where(
        and(
          eq(calendarFeeds.userId, session.user.id),
          eq(calendarFeeds.homeId, homeId),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(calendarFeeds)
        .set({
          tokenHash: generated.hash,
          tokenPrefix: generated.prefix,
          revokedAt: null,
          lastUsedAt: null,
        })
        .where(eq(calendarFeeds.id, existing.id));
    } else {
      await db.insert(calendarFeeds).values({
        userId: session.user.id,
        homeId,
        tokenHash: generated.hash,
        tokenPrefix: generated.prefix,
      });
    }
    const url = new URL(
      `/calendar/feed/${generated.token}`,
      getEnv().NEXT_PUBLIC_APP_URL,
    ).toString();
    return Response.json(
      { token: generated.token, url, requestId: id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const { homeId } = bodyInput.parse(await request.json());
    await requireHomeAccess(homeId);
    await db
      .update(calendarFeeds)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(calendarFeeds.userId, session.user.id),
          eq(calendarFeeds.homeId, homeId),
          isNull(calendarFeeds.revokedAt),
        ),
      );
    return Response.json({ ok: true, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
