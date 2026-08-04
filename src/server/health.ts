import "server-only";

import { checkDatabase } from "@/db";
import { virusScannerHealth } from "@/src/server/security/virus-scanner";
import { getStorage } from "@/src/server/storage";

const headers = { "cache-control": "no-store" };
const readinessTimeoutMs = 5_000;

async function checkWithTimeout(check: () => Promise<boolean>) {
  try {
    return await Promise.race([
      check(),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), readinessTimeoutMs),
      ),
    ]);
  } catch {
    return false;
  }
}

export function livenessResponse() {
  return Response.json(
    {
      status: "alive",
      service: "homi",
      time: new Date().toISOString(),
    },
    { headers },
  );
}

export async function readinessResponse() {
  const [database, storage, antivirus] = await Promise.all([
    checkWithTimeout(checkDatabase),
    checkWithTimeout(() => getStorage().check()),
    virusScannerHealth().catch(() => ({ enabled: true, healthy: false })),
  ]);
  const checks = {
    database,
    storage,
    clamav: antivirus.healthy,
  };
  const ready = Object.values(checks).every(Boolean);

  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      checks,
      antivirus: { enabled: antivirus.enabled },
      time: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers },
  );
}
