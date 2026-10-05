import { db } from "@/db";
import { shoppingLists } from "@/db/shopping-schema";
import { shoppingListInput } from "@/src/features/shopping/input";
import { errorResponse } from "@/src/server/http";
import {
  listShopping,
  shoppingHomeAccess,
} from "@/src/server/services/shopping";
export async function GET(request: Request) {
  try {
    const homeId = new URL(request.url).searchParams.get("homeId") ?? "";
    const { member } = await shoppingHomeAccess(homeId);
    return Response.json(
      { lists: await listShopping(homeId), canEdit: member.role !== "VIEWER" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = shoppingListInput.parse(await request.json());
    const { session } = await shoppingHomeAccess(body.homeId, true);
    const [list] = await db
      .insert(shoppingLists)
      .values({ ...body, createdBy: session.user.id })
      .returning();
    return Response.json({ list }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
