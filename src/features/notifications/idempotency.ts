import { createHash } from "node:crypto";

export function reminderIdempotencyKey(input: {
  userId: string;
  entityType: string;
  entityId: string;
  reminderType: string;
  channel: string;
  scheduledFor: Date;
}) {
  const day = input.scheduledFor.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(
      [input.userId, input.entityType, input.entityId, input.reminderType, input.channel, day].join(":"),
    )
    .digest("hex");
}

