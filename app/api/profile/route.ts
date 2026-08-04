import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { profileAvatarUrl } from "@/src/server/profile/avatar";
import { requireVerifiedUser } from "@/src/server/authorization";
import { AppError } from "@/src/server/errors";
import { errorResponse, requestId } from "@/src/server/http";
import { enforceRateLimit } from "@/src/server/rate-limit";

const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const [profile] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    if (!profile) throw new AppError("NOT_FOUND", "Profile not found.", 404);
    return Response.json({
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatarUrl: profileAvatarUrl(profile.id, profile.image),
      },
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    await enforceRateLimit("profile-update", session.user.id, {
      limit: 20,
      windowSeconds: 3600,
    });
    const body = profileInput.parse(await request.json());
    const [profile] = await db
      .update(user)
      .set({ name: body.name, updatedAt: new Date() })
      .where(eq(user.id, session.user.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      });
    if (!profile) throw new AppError("NOT_FOUND", "Profile not found.", 404);
    return Response.json({
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatarUrl: profileAvatarUrl(profile.id, profile.image),
      },
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
