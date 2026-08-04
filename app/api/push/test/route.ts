import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { pushConfiguration, sendPushToUser } from "@/src/server/push";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    if (!pushConfiguration()) {
      return Response.json(
        {
          error: {
            code: "NOT_CONFIGURED",
            message: "Web Push has not been configured by this Homi installation.",
          },
        },
        { status: 503 },
      );
    }
    const result = await sendPushToUser(session.user.id, {
      title: "Homi notifications are ready",
      body: "This device can now receive private maintenance and warranty reminders.",
      url: "/notifications",
      tag: "homi-push-test",
    });
    if (!result.delivered) {
      return Response.json(
        {
          error: {
            code: "DELIVERY_FAILED",
            message: "No active device accepted the test notification.",
          },
          result,
        },
        { status: 409 },
      );
    }
    return Response.json({ delivered: true, result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
