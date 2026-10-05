import { z } from "zod";
export const shoppingListInput = z.object({
  homeId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});
export const shoppingListUpdate = shoppingListInput.pick({ name: true });
export const shoppingItemInput = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.string().trim().max(60).default(""),
});
export const shoppingItemUpdate = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    quantity: z.string().trim().max(60).optional(),
    checked: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide a field to update.",
  );
