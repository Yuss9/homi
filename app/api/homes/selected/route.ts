import { cookies } from "next/headers";
import { z } from "zod";
import { selectedHomeCookie } from "@/src/features/homes/selection";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";

const input = z.object({ homeId: z.string().uuid() });

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const { homeId } = input.parse(await request.json());
    await requireHomeAccess(homeId);
    const store = await cookies();
    store.set(selectedHomeCookie, homeId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return Response.json({ homeId, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
