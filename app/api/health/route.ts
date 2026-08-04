import { livenessResponse } from "@/src/server/health";

export const dynamic = "force-dynamic";

export function GET() {
  return livenessResponse();
}
