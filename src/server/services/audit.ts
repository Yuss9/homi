import "server-only";
import { db } from "../../../db";
import { auditLogs } from "../../../db/schema";

export async function audit(input: {
  actorId?: string;
  homeId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  await db.insert(auditLogs).values(input);
}

