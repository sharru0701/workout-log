import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { uxEventLog } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type IncomingUxEvent = {
  id: string;
  name: string;
  recordedAt: string;
  props?: Record<string, string | number | boolean | null>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toSafeEvent(raw: unknown): IncomingUxEvent | null {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const recordedAt = typeof raw.recordedAt === "string" ? raw.recordedAt.trim() : "";
  const props = isPlainObject(raw.props) ? (raw.props as Record<string, unknown>) : {};

  if (!id || id.length > 128) return null;
  if (!name || name.length > 128) return null;
  if (!recordedAt) return null;
  const parsedDate = new Date(recordedAt);
  if (!Number.isFinite(parsedDate.getTime())) return null;

  const safeProps: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof key !== "string" || !key.trim() || key.length > 100) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safeProps[key] = value;
    }
  }

  return {
    id,
    name,
    recordedAt,
    props: safeProps,
  };
}

async function POSTImpl(req: Request) {
  try {
    const userId = getAuthenticatedUserId();
    const body: unknown = await req.json().catch(() => ({}));
    const rawEvents: unknown[] =
      isPlainObject(body) && Array.isArray(body.events) ? body.events : [];
    if (rawEvents.length === 0) {
      return NextResponse.json({ acceptedIds: [], acceptedCount: 0, droppedCount: 0 });
    }
    if (rawEvents.length > 200) {
      return NextResponse.json({ error: "events must be <= 200" }, { status: 400 });
    }

    const normalized = rawEvents.map(toSafeEvent).filter((event): event is IncomingUxEvent => Boolean(event));
    if (normalized.length === 0) {
      return NextResponse.json({ acceptedIds: [], acceptedCount: 0, droppedCount: rawEvents.length });
    }

    const dedupedById = new Map<string, IncomingUxEvent>();
    for (const event of normalized) dedupedById.set(event.id, event);
    const accepted = Array.from(dedupedById.values());

    await db
      .insert(uxEventLog)
      .values(
        accepted.map((event) => ({
          userId,
          clientEventId: event.id,
          name: event.name,
          recordedAt: new Date(event.recordedAt),
          props: event.props ?? {},
        })),
      )
      .onConflictDoNothing();

    return NextResponse.json({
      acceptedIds: accepted.map((event) => event.id),
      acceptedCount: accepted.length,
      droppedCount: rawEvents.length - accepted.length,
    });
  } catch (error: unknown) {
    logError("api.handler_error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging(POSTImpl);
