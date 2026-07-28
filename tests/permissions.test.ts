import { describe, expect, it } from "vitest";
import { hasPermission, roles } from "../src/features/members/permissions";
describe("home permissions", () => {
  it("keeps viewers read-only", () => {
    expect(hasPermission("VIEWER", "view")).toBe(true);
    expect(hasPermission("VIEWER", "manageAssets")).toBe(false);
  });
  it("lets members record work but not change roles", () => {
    expect(hasPermission("MEMBER", "createMaintenanceRecord")).toBe(true);
    expect(hasPermission("MEMBER", "manageMembers")).toBe(false);
  });
  it("reserves transfer and deletion for owners", () => {
    for (const role of roles) expect(hasPermission(role, "deleteHome")).toBe(role === "OWNER");
  });
});

