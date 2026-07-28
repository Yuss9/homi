export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", service: "homi", time: new Date().toISOString() });
}

