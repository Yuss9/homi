import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { webhooks } from "@/db/connected-platform-schema";
import { requireHomeRole } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { encryptSecret } from "@/src/server/integrations/secrets";
import {
  generateWebhookSecret,
  validateWebhookUrl,
  webhookEvents,
} from "@/src/server/integrations/webhooks";

const input = z.object({
  homeId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  url: z.string().url().transform((value, context) => {
    try {
      return validateWebhookUrl(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid webhook URL.",
      });
      return z.NEVER;
    }
  }),
  events: z.array(z.enum(webhookEvents)).min(1).max(webhookEvents.length),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const homeId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("homeId"));
    await requireHomeRole(homeId, ["OWNER", "ADMIN"]);
    const rows = await db
      .select({
        id: webhooks.id,
        name: webhooks.name,
        url: webhooks.url,
        events: webhooks.events,
        enabled: webhooks.enabled,
        failureCount: webhooks.failureCount,
        lastSuccessAt: webhooks.lastSuccessAt,
        disabledAt: webhooks.disabledAt,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(and(eq(webhooks.homeId, homeId), isNull(webhooks.disabledAt)))
      .orderBy(desc(webhooks.createdAt));
    return Response.json({ webhooks: rows, availableEvents: webhookEvents, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const body = input.parse(await request.json());
    const { session } = await requireHomeRole(body.homeId, ["OWNER", "ADMIN"]);
    const existing = await db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.homeId, body.homeId), isNull(webhooks.disabledAt)));
    if (existing.length >= 20)
      throw new AppError("CONFLICT", "This home already has 20 active webhooks.", 409);

    const secret = generateWebhookSecret();
    const [webhook] = await db
      .insert(webhooks)
      .values({
        homeId: body.homeId,
        createdBy: session.user.id,
        name: body.name,
        url: body.url,
        events: [...new Set(body.events)],
        secretCiphertext: encryptSecret(secret),
      })
      .returning({
        id: webhooks.id,
        name: webhooks.name,
        url: webhooks.url,
        events: webhooks.events,
        createdAt: webhooks.createdAt,
      });
    return Response.json({ webhook, secret, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
