import { describe, expect, it } from "vitest";
import { createInvitationToken, hashInvitationToken, verifyInvitationToken } from "../src/features/members/invitation-token";
import { reminderIdempotencyKey } from "../src/features/notifications/idempotency";
import { enabledChannels, shouldSendReminder } from "../src/features/notifications/preferences";
import { validateUpload } from "../src/server/storage/validation";
import { envSchema } from "../src/server/env";
describe("security and notification utilities", () => {
  it("stores only invitation hashes and compares them safely", () => {
    const { token, hash } = createInvitationToken();
    expect(token).not.toBe(hash); expect(hash).toBe(hashInvitationToken(token)); expect(verifyInvitationToken(token, hash)).toBe(true); expect(verifyInvitationToken(`${token}x`, hash)).toBe(false);
  });
  it("creates deterministic reminder idempotency keys per day", () => {
    const base={userId:"u",entityType:"TASK",entityId:"e",reminderType:"DUE",channel:"EMAIL",scheduledFor:new Date("2026-07-24T02:00:00Z")};
    expect(reminderIdempotencyKey(base)).toBe(reminderIdempotencyKey({...base,scheduledFor:new Date("2026-07-24T22:00:00Z")}));
    expect(reminderIdempotencyKey(base)).not.toBe(reminderIdempotencyKey({...base,channel:"IN_APP"}));
  });
  it("respects notification channel and reminder windows", () => {
    const preference={emailEnabled:false,inAppEnabled:true,maintenanceReminderDays:7,warrantyReminderDays:30,documentExpiryReminderDays:14};
    expect(enabledChannels(preference)).toEqual(["IN_APP"]);
    expect(shouldSendReminder(preference,"MAINTENANCE",new Date("2026-08-05"),new Date("2026-08-01"))).toBe(true);
    expect(shouldSendReminder(preference,"MAINTENANCE",new Date("2026-08-12"),new Date("2026-08-01"))).toBe(false);
  });
  it("validates actual bytes rather than extensions", async () => {
    const pdf=new TextEncoder().encode("%PDF-1.7\nfake test body");
    await expect(validateUpload(pdf,"application/pdf",1000)).resolves.toMatchObject({mimeType:"application/pdf"});
    await expect(validateUpload(new TextEncoder().encode("not a file"),"application/pdf",1000)).rejects.toThrow(/Only PDF/i);
  });
  it("rejects oversized files", async () => await expect(validateUpload(new Uint8Array(20), "application/pdf", 10)).rejects.toThrow(/exceeds/i));
  it("validates environment combinations", () => {
    expect(envSchema.safeParse({ STORAGE_PROVIDER:"s3" }).success).toBe(false);
    expect(envSchema.safeParse({ STORAGE_PROVIDER:"local" }).success).toBe(true);
  });
});

