import { ZodError } from "zod";
import { AppError, publicError } from "./errors";
import { logger } from "./logger";

export function errorResponse(error: unknown, requestId?: string) {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the highlighted fields.",
          fields: error.flatten().fieldErrors,
        },
        requestId,
      },
      { status: 400 },
    );
  }
  const safe = publicError(error);
  const status = error instanceof AppError ? error.status : 500;
  if (status >= 500) logger.error({ error, requestId }, "request_failed");
  return Response.json({ error: safe, requestId }, { status });
}

export function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

