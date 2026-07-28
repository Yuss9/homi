import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", request.headers.get("x-request-id") ?? crypto.randomUUID());
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestHeaders.get("x-request-id")!);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon|apple-icon|favicon.ico).*)"] };

