import "server-only";

import { createHmac } from "node:crypto";
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/connected-platform-schema";
import {
  generateWebhookSecret,
  validateWebhookUrl,
} from "@/src/features/integrations/security";
import { decryptSecret } from "@/src/server/integrations/secrets";

export { generateWebhookSecret, validateWebhookUrl };

export const webhookEvents = [
  "maintenance.created",
  "maintenance.completed",
  "repair.created",
  "repair.updated",
  "asset.updated",
  "document.expiring",
  "warranty.expiring",
] as const;

export type WebhookEvent = (typeof webhookEvents)[number];

export async function enqueueWebhookEvent(
  homeId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const hooks = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(
      and(
        eq(webhooks.homeId, homeId),
        eq(webhooks.enabled, true),
        isNull(webhooks.disabledAt),
        sql`${webhooks.events} ? ${event}`,
      ),
    );
  if (!hooks.length) return [];
  const deliveries = await db
    .insert(webhookDeliveries)
    .values(
      hooks.map((hook) => ({
        webhookId: hook.id,
        event,
        payload,
      })),
    )
    .returning({ id: webhookDeliveries.id });
  await processWebhookDeliveries(deliveries.map((delivery) => delivery.id));
  return deliveries;
}

export async function processWebhookDeliveries(deliveryIds?: string[]) {
  const now = new Date();
  const rows = await db
    .select({ delivery: webhookDeliveries, webhook: webhooks })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(
      and(
        deliveryIds?.length
          ? inArray(webhookDeliveries.id, deliveryIds)
          : eq(webhookDeliveries.status, "PENDING"),
        lte(webhookDeliveries.nextAttemptAt, now),
        eq(webhooks.enabled, true),
        isNull(webhooks.disabledAt),
      ),
    )
    .orderBy(asc(webhookDeliveries.createdAt))
    .limit(25);

  for (const row of rows) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      id: row.delivery.id,
      event: row.delivery.event,
      createdAt: row.delivery.createdAt.toISOString(),
      data: row.delivery.payload,
    });
    const signature = createHmac(
      "sha256",
      decryptSecret(row.webhook.secretCiphertext),
    )
      .update(`${timestamp}.${body}`)
      .digest("hex");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(row.webhook.url, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "user-agent": "Homi-Webhooks/1.0",
          "x-homi-event": row.delivery.event,
          "x-homi-delivery": row.delivery.id,
          "x-homi-timestamp": timestamp,
          "x-homi-signature": `sha256=${signature}`,
        },
        body,
      });
      if (!response.ok)
        throw new Error(`Webhook returned HTTP ${response.status}.`);
      await db.transaction(async (tx) => {
        await tx
          .update(webhookDeliveries)
          .set({
            status: "DELIVERED",
            attempts: row.delivery.attempts + 1,
            responseStatus: response.status,
            deliveredAt: new Date(),
            error: null,
          })
          .where(eq(webhookDeliveries.id, row.delivery.id));
        await tx
          .update(webhooks)
          .set({
            failureCount: 0,
            lastSuccessAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(webhooks.id, row.webhook.id));
      });
    } catch (error) {
      const attempts = row.delivery.attempts + 1;
      const permanentlyFailed = attempts >= 5;
      const nextAttemptAt = new Date(
        Date.now() + Math.min(60, 2 ** attempts) * 60 * 1000,
      );
      await db.transaction(async (tx) => {
        await tx
          .update(webhookDeliveries)
          .set({
            status: permanentlyFailed ? "FAILED" : "PENDING",
            attempts,
            nextAttemptAt,
            error:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : "Delivery failed.",
          })
          .where(eq(webhookDeliveries.id, row.delivery.id));
        await tx
          .update(webhooks)
          .set({
            failureCount: row.webhook.failureCount + 1,
            disabledAt:
              row.webhook.failureCount + 1 >= 10
                ? new Date()
                : row.webhook.disabledAt,
            updatedAt: new Date(),
          })
          .where(eq(webhooks.id, row.webhook.id));
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return rows.length;
}
