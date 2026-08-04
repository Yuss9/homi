import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { savedSearches } from "@/db/connected-platform-schema";
import { requireHomeAccess, requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const filterInput = z.object({
  types: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  statuses: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

const input = z.object({
  homeId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  query: z.string().trim().min(2).max(80),
  filters: filterInput.default({}),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const homeId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("homeId"));
    await requireHomeAccess(homeId);
    const rows = await db
      .select()
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.userId, session.user.id),
          eq(savedSearches.homeId, homeId),
        ),
      )
      .orderBy(asc(savedSearches.name));
    return Response.json({ searches: rows, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const body = input.parse(await request.json());
    await requireHomeAccess(body.homeId);
    const [saved] = await db
      .insert(savedSearches)
      .values({ userId: session.user.id, ...body })
      .onConflictDoUpdate({
        target: [savedSearches.userId, savedSearches.homeId, savedSearches.name],
        set: {
          query: body.query,
          filters: body.filters,
          updatedAt: new Date(),
        },
      })
      .returning();
    return Response.json({ search: saved, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
