import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shoppingLists } from "@/db/shopping-schema";
import { shoppingListUpdate } from "@/src/features/shopping/input";
import { errorResponse } from "@/src/server/http";
import { shoppingListAccess } from "@/src/server/services/shopping";
type Context = { params: Promise<{ listId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { listId } = await context.params;
    const body = shoppingListUpdate.parse(await request.json());
    await shoppingListAccess(listId, true);
    const [list] = await db
      .update(shoppingLists)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(shoppingLists.id, listId))
      .returning();
    return Response.json({ list });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const { listId } = await context.params;
    await shoppingListAccess(listId, true);
    await db.delete(shoppingLists).where(eq(shoppingLists.id, listId));
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
