import { describe, expect, it } from "vitest";
import { membershipChangeReason } from "../src/features/members/management";

describe("household membership management", () => {
  it("keeps the owner immutable", () => {
    expect(
      membershipChangeReason(
        { userId: "actor", role: "OWNER" },
        { userId: "owner", role: "OWNER" },
      ),
    ).toMatch(/owner cannot/i);
  });

  it("prevents administrators from managing other administrators", () => {
    expect(
      membershipChangeReason(
        { userId: "actor", role: "ADMIN" },
        { userId: "target", role: "ADMIN" },
      ),
    ).toMatch(/only the owner/i);
  });

  it("allows an owner to promote a member", () => {
    expect(
      membershipChangeReason(
        { userId: "actor", role: "OWNER" },
        { userId: "target", role: "MEMBER" },
        "ADMIN",
      ),
    ).toBeNull();
  });

  it("prevents administrators from promoting another administrator", () => {
    expect(
      membershipChangeReason(
        { userId: "actor", role: "ADMIN" },
        { userId: "target", role: "MEMBER" },
        "ADMIN",
      ),
    ).toMatch(/only the owner/i);
  });

  it("prevents managers from changing their own membership", () => {
    expect(
      membershipChangeReason(
        { userId: "same", role: "OWNER" },
        { userId: "same", role: "ADMIN" },
        "MEMBER",
      ),
    ).toMatch(/your own/i);
  });
});
