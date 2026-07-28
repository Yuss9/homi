import "server-only";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { getEnv } from "../env";
import { AppError } from "../errors";

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();
const redis = getEnv().REDIS_URL ? new Redis(getEnv().REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;

export function hashRateLimitIdentity(identity: string) {
  return createHash("sha256")
    .update(`${getEnv().BETTER_AUTH_SECRET.slice(0, 16)}:${identity}`)
    .digest("hex");
}

export async function enforceRateLimit(
  action: string,
  identity: string,
  options: { limit: number; windowSeconds: number },
) {
  const key = `homi:rl:${action}:${hashRateLimitIdentity(identity)}`;
  if (redis) {
    if (redis.status === "wait") await redis.connect();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, options.windowSeconds);
    if (count > options.limit) throw new AppError("RATE_LIMITED", "Too many attempts. Try again shortly.", 429);
    return;
  }

  const now = Date.now();
  const current = memory.get(key);
  if (!current || current.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 });
    return;
  }
  current.count += 1;
  if (current.count > options.limit)
    throw new AppError("RATE_LIMITED", "Too many attempts. Try again shortly.", 429);
}

