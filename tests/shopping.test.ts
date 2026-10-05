import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  shoppingItemInput,
  shoppingItemUpdate,
  shoppingListInput,
} from "../src/features/shopping/input";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  role: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/src/server/authorization", () => ({
  requireHomeAccess: mocks.access,
  requireHomeRole: mocks.role,
}));
vi.mock("@/db", () => ({ db: { select: mocks.select, update: mocks.update } }));
import {
  shoppingHomeAccess,
  shoppingListAccess,
  updateShoppingItem,
} from "../src/server/services/shopping";

const homeId = "11111111-1111-4111-8111-111111111111";
const listId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
function selection(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mocks.select.mockReturnValueOnce(chain);
}
beforeEach(() => vi.resetAllMocks());

describe("shared shopping boundaries", () => {
  it("rejects whitespace names, oversized quantities and non-boolean checkbox state", () => {
    expect(shoppingListInput.safeParse({ homeId, name: "  " }).success).toBe(
      false,
    );
    expect(
      shoppingItemInput.safeParse({ name: "Milk", quantity: "x".repeat(61) })
        .success,
    ).toBe(false);
    expect(shoppingItemUpdate.safeParse({ checked: "false" }).success).toBe(
      false,
    );
    expect(shoppingItemUpdate.safeParse({}).success).toBe(false);
    expect(shoppingItemUpdate.parse({ checked: false })).toEqual({
      checked: false,
    });
  });
  it("uses the list's stored home rather than trusting a caller-supplied home", async () => {
    selection([{ id: listId, homeId }]);
    mocks.access.mockRejectedValue(new Error("Home not found"));
    await expect(shoppingListAccess(listId)).rejects.toThrow("Home not found");
    expect(mocks.access).toHaveBeenCalledWith(homeId);
  });
  it("lets viewers read but delegates all writes to the member role check", async () => {
    selection([{ id: homeId }]);
    mocks.access.mockResolvedValue({ member: { role: "VIEWER" } });
    await expect(shoppingHomeAccess(homeId)).resolves.toMatchObject({
      member: { role: "VIEWER" },
    });
    mocks.role.mockRejectedValue(new Error("Forbidden"));
    await expect(shoppingHomeAccess(homeId, true)).rejects.toThrow("Forbidden");
    expect(mocks.role).toHaveBeenCalledWith(homeId, [
      "OWNER",
      "ADMIN",
      "MEMBER",
    ]);
  });
  it("rejects writes to archived homes", async () => {
    selection([]);
    mocks.role.mockResolvedValue({ member: { role: "MEMBER" } });
    await expect(shoppingHomeAccess(homeId, true)).rejects.toThrow(
      "Home not found",
    );
  });
  it("does not update an item belonging to another list", async () => {
    selection([{ id: listId, homeId }]);
    selection([{ id: homeId }]);
    mocks.role.mockResolvedValue({ member: { role: "OWNER" } });
    mocks.update.mockReturnValue({
      set: vi
        .fn()
        .mockReturnValue({
          where: vi
            .fn()
            .mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
    });
    await expect(
      updateShoppingItem(listId, itemId, { checked: true }),
    ).rejects.toThrow("Item not found in this list");
  });
});
