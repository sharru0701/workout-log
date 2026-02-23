import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logError, logInfo } from "@/server/observability/logger";
import { checkIpRateLimit } from "@/server/security/rateLimit";

export type ApiRouteHandler<TContext = unknown> = (
  req: Request,
  ctx: TContext,
) => Promise<Response> | Response;

function trySetRequestIdHeader(response: Response, requestId: string): Response {
  if (response.headers.get("x-request-id")) {
    return response;
  }

  try {
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    // Some responses can have immutable headers; clone in that case.
    const cloned = new Response(response.body, response);
    cloned.headers.set("x-request-id", requestId);
    return cloned;
  }
}

function elapsedMs(start: bigint): number {
  const elapsedNs = Number(process.hrtime.bigint() - start);
  return Math.round((elapsedNs / 1_000_000) * 100) / 100;
}

export function withApiLogging<TContext = unknown>(handler: ApiRouteHandler<TContext>) {
  return async (req: Request, ctx: TContext): Promise<Response> => {
    const startedAt = process.hrtime.bigint();
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const route = new URL(req.url).pathname;
    const method = req.method;

    try {
      const rateLimit = checkIpRateLimit({ req, route, method });
      if (!rateLimit.ok) {
        const limited = NextResponse.json(
          { error: "Too Many Requests", requestId },
          { status: 429 },
        );
        limited.headers.set("retry-after", String(rateLimit.retryAfterSeconds));
        limited.headers.set("x-request-id", requestId);
        logInfo("api.request", {
          requestId,
          method,
          route,
          status: 429,
          latencyMs: elapsedMs(startedAt),
        });
        return limited;
      }

      const response = await handler(req, ctx);
      const responseWithId = trySetRequestIdHeader(response, requestId);
      logInfo("api.request", {
        requestId,
        method,
        route,
        status: responseWithId.status,
        latencyMs: elapsedMs(startedAt),
      });
      return responseWithId;
    } catch (error) {
      logError("api.error", {
        requestId,
        method,
        route,
        status: 500,
        latencyMs: elapsedMs(startedAt),
        error,
      });

      const response = NextResponse.json(
        { error: "Internal Server Error", requestId },
        { status: 500 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }
  };
}
