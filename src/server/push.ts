import "server-only";

import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { pushSubscriptions } from "../../db/high-value-schema";
import { getEnv } from "./env";
import { logger } from "./logger";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type SubscriptionRow = typeof pushSubscriptions.$inferSelect;

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4),
    "base64",
  );
}

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function pushConfiguration() {
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return null;
  }
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

function vapidToken(endpoint: string) {
  const config = pushConfiguration();
  if (!config) throw new Error("Web Push is not configured.");
  const publicKey = decodeBase64Url(config.publicKey);
  const privateKey = decodeBase64Url(config.privateKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
    throw new Error("The configured VAPID key pair is invalid.");
  }
  const header = encodeBase64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: config.subject,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(publicKey.subarray(1, 33)),
      y: encodeBase64Url(publicKey.subarray(33, 65)),
      d: encodeBase64Url(privateKey),
    },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${unsigned}.${encodeBase64Url(signature)}`;
}

function encryptPayload(subscription: SubscriptionRow, payload: PushPayload) {
  const clientPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 4) {
    throw new Error("The push subscription public key is invalid.");
  }
  if (authSecret.length < 16) {
    throw new Error("The push subscription auth secret is invalid.");
  }

  const ecdh = createECDH("prime256v1");
  const serverPublicKey = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(clientPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    clientPublicKey,
    serverPublicKey,
  ]);
  const inputKeyMaterial = Buffer.from(
    hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32),
  );
  const salt = randomBytes(16);
  const contentKey = Buffer.from(
    hkdfSync(
      "sha256",
      inputKeyMaterial,
      salt,
      Buffer.from("Content-Encoding: aes128gcm\0", "utf8"),
      16,
    ),
  );
  const nonce = Buffer.from(
    hkdfSync(
      "sha256",
      inputKeyMaterial,
      salt,
      Buffer.from("Content-Encoding: nonce\0", "utf8"),
      12,
    ),
  );
  const plaintext = Buffer.concat([
    Buffer.from(JSON.stringify(payload), "utf8"),
    Buffer.from([2]),
  ]);
  if (plaintext.length > 3993) throw new Error("Push payload is too large.");
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    ciphertext,
    cipher.getAuthTag(),
  ]);
}

async function sendSubscription(
  subscription: SubscriptionRow,
  payload: PushPayload,
) {
  const config = pushConfiguration();
  if (!config) return { delivered: false, disabled: false };
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${vapidToken(subscription.endpoint)}, k=${config.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encryptPayload(subscription, payload),
  });
  if (response.status === 404 || response.status === 410) {
    return { delivered: false, disabled: true };
  }
  if (!response.ok) {
    throw new Error(
      `Push service returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  return { delivered: true, disabled: false };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pushConfiguration()) return { delivered: 0, failed: 0, disabled: 0 };
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.disabledAt),
      ),
    );
  const result = { delivered: 0, failed: 0, disabled: 0 };
  for (const subscription of subscriptions) {
    try {
      const delivery = await sendSubscription(subscription, payload);
      if (delivery.disabled) {
        result.disabled += 1;
        await db
          .update(pushSubscriptions)
          .set({ disabledAt: new Date(), updatedAt: new Date() })
          .where(eq(pushSubscriptions.id, subscription.id));
      } else if (delivery.delivered) {
        result.delivered += 1;
        await db
          .update(pushSubscriptions)
          .set({
            lastSuccessAt: new Date(),
            failureCount: 0,
            updatedAt: new Date(),
          })
          .where(eq(pushSubscriptions.id, subscription.id));
      }
    } catch (error) {
      result.failed += 1;
      const failures = subscription.failureCount + 1;
      await db
        .update(pushSubscriptions)
        .set({
          failureCount: failures,
          disabledAt: failures >= 5 ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, subscription.id));
      logger.error(
        { subscriptionId: subscription.id, userId, error },
        "web_push_delivery_failed",
      );
    }
  }
  return result;
}
