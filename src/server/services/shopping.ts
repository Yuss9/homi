import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { homes } from "@/db/schema";
import { shoppingItems, shoppingLists } from "@/db/shopping-schema";
import { requireHomeAccess, requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";

export async function shoppingHomeAccess(homeId: string, write = false) {
  z.string().uuid().parse(homeId);
  const access = write
    ? await requireHomeRole(homeId, ["OWNER", "ADMIN", "MEMBER"])
    : await requireHomeAccess(homeId);
  const [home] = await db
    .select({ id: homes.id })
    .from(homes)
    .where(and(eq(homes.id, homeId), isNull(homes.archivedAt)))
    .limit(1);
  if (!home) throw new AppError("NOT_FOUND", "Home not found.", 404);
  return access;
}

export async function shoppingListAccess(listId: string, write = false) {
  z.string().uuid().parse(listId);
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.id, listId))
    .limit(1);
  if (!list) throw new AppError("NOT_FOUND", "Shopping list not found.", 404);
  await shoppingHomeAccess(list.homeId, write);
  return list;
}

export async function listShopping(homeId: string) {
  const rows = await db
    .select({ list: shoppingLists, item: shoppingItems })
    .from(shoppingLists)
    .leftJoin(shoppingItems, eq(shoppingItems.listId, shoppingLists.id))
    .where(eq(shoppingLists.homeId, homeId))
    .orderBy(
      asc(shoppingLists.createdAt),
      asc(shoppingItems.createdAt),
      asc(shoppingItems.id),
    );
  const lists = new Map<
    string,
    typeof shoppingLists.$inferSelect & {
      items: (typeof shoppingItems.$inferSelect)[];
    }
  >();
  for (const { list, item } of rows) {
    if (!lists.has(list.id)) lists.set(list.id, { ...list, items: [] });
    if (item) lists.get(list.id)!.items.push(item);
  }
  return [...lists.values()];
}

export async function updateShoppingItem(
  listId: string,
  itemId: string,
  values: Partial<
    Pick<typeof shoppingItems.$inferInsert, "name" | "quantity" | "checked">
  >,
) {
  z.string().uuid().parse(itemId);
  await shoppingListAccess(listId, true);
  const [item] = await db
    .update(shoppingItems)
    .set(values)
    .where(and(eq(shoppingItems.id, itemId), eq(shoppingItems.listId, listId)))
    .returning();
  if (!item)
    throw new AppError("NOT_FOUND", "Item not found in this list.", 404);
  return item;
}
