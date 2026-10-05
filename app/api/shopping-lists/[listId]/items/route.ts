import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shoppingItems } from "@/db/shopping-schema";
import { shoppingItemInput } from "@/src/features/shopping/input";
import { errorResponse } from "@/src/server/http";
import { shoppingListAccess } from "@/src/server/services/shopping";
type Context = { params: Promise<{ listId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { listId } = await context.params;
    const body = shoppingItemInput.parse(await request.json());
    await shoppingListAccess(listId, true);
    const [item] = await db
      .insert(shoppingItems)
      .values({ ...body, listId })
      .returning();
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const { listId } = await context.params;
    await shoppingListAccess(listId, true);
    await db
      .delete(shoppingItems)
      .where(
        and(eq(shoppingItems.listId, listId), eq(shoppingItems.checked, true)),
      );
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
