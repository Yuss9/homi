import { readinessResponse } from "@/src/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return readinessResponse();
}
