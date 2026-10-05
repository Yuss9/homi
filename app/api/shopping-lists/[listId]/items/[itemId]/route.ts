import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { shoppingItems } from "@/db/shopping-schema";
import { shoppingItemUpdate } from "@/src/features/shopping/input";
import { AppError } from "@/src/server/errors";
import { errorResponse } from "@/src/server/http";
import {
  shoppingListAccess,
  updateShoppingItem,
} from "@/src/server/services/shopping";
type Context = { params: Promise<{ listId: string; itemId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { listId, itemId } = await context.params;
    const body = shoppingItemUpdate.parse(await request.json());
    return Response.json({
      item: await updateShoppingItem(listId, itemId, body),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const { listId, itemId } = await context.params;
    z.string().uuid().parse(itemId);
    await shoppingListAccess(listId, true);
    const rows = await db
      .delete(shoppingItems)
      .where(
        and(eq(shoppingItems.id, itemId), eq(shoppingItems.listId, listId)),
      )
      .returning({ id: shoppingItems.id });
    if (!rows.length)
      throw new AppError("NOT_FOUND", "Item not found in this list.", 404);
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
