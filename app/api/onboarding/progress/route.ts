import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
const input = z.object({ step: z.number().int().min(0).max(5), completed: z.boolean().default(false) });
export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const value = input.parse(await request.json());
    await db.update(user).set({ onboardingStep: value.step, onboardingCompletedAt: value.completed ? new Date() : undefined, updatedAt: new Date() }).where(eq(user.id, session.user.id));
    return Response.json({ ok: true, requestId: id });
  } catch (error) { return errorResponse(error, id); }
}

