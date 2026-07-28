import { checkDatabase } from "@/db";
import { getStorage } from "@/src/server/storage";

export const dynamic = "force-dynamic";
export async function GET() {
  const checks = { database: false, storage: false };
  try {
    [checks.database, checks.storage] = await Promise.all([checkDatabase(), getStorage().check()]);
  } catch {
    return Response.json({ status: "not_ready", checks }, { status: 503 });
  }
  return Response.json({ status: "ready", checks });
}

