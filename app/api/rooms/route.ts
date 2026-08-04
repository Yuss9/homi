import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { requireHomeAccess, requireHomeRole } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { createRoom, roomInput } from "@/src/server/services/homes";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId)
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "homeId is required",
          },
        },
        { status: 400 },
      );
    await requireHomeAccess(homeId);
    const rows = await db
      .select()
      .from(rooms)
      .where(
        and(eq(rooms.homeId, homeId), sql`"rooms"."archived_at" is null`),
      )
      .orderBy(rooms.name);
    return Response.json({ rooms: rows, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = roomInput.parse(await request.json());
    await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);
    return Response.json(
      { room: await createRoom(body), requestId: id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
