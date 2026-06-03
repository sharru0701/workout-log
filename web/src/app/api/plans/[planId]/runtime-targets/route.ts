import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { requireAuthenticatedUserId } from "@/server/auth/user";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { applyManualRuntimeAdjustment } from "@/server/progression/autoProgression";
import { readLastTargetEvents, type LastTargetEvent } from "@/server/progression/last-events";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";

type Ctx = { params: Promise<{ planId: string }> };

const MAX_WORK_KG = 500;

/**
 * 자동 진행 플랜의 "현재 TM(runtime workKg)"을 사용자가 직접 보정한다.
 * 보정은 가장 최근 진행 이벤트의 meta.targetDecisionsOverride에 머지되어
 * 이후 rebuild/replay에서도 보존된다(autoProgression.applyManualRuntimeAdjustment).
 * 응답은 progression-state와 동형({ state, targetsLastEvent })으로 클라가 동일 파싱한다.
 */
async function POSTImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { planId } = await ctx.params;
    const userId = await requireAuthenticatedUserId();
    const body = (await req.json().catch(() => ({}))) as { adjustments?: unknown };

    const rawAdjustments =
      body.adjustments &&
      typeof body.adjustments === "object" &&
      !Array.isArray(body.adjustments)
        ? (body.adjustments as Record<string, unknown>)
        : null;
    if (!rawAdjustments) {
      return NextResponse.json(
        { error: locale === "ko" ? "조정할 항목이 없습니다." : "No adjustments provided." },
        { status: 400 },
      );
    }

    const adjustments: Record<string, { workKg: number }> = {};
    for (const [key, value] of Object.entries(rawAdjustments)) {
      const raw = (value ?? {}) as { workKg?: unknown };
      const workKg = typeof raw.workKg === "number" ? raw.workKg : Number(raw.workKg);
      if (!key.trim() || !Number.isFinite(workKg) || workKg < 0 || workKg > MAX_WORK_KG) {
        return NextResponse.json(
          {
            error:
              locale === "ko"
                ? `유효하지 않은 무게 값입니다 (0~${MAX_WORK_KG}kg).`
                : `Invalid weight value (0–${MAX_WORK_KG}kg).`,
          },
          { status: 400 },
        );
      }
      adjustments[key.trim()] = { workKg };
    }
    if (Object.keys(adjustments).length === 0) {
      return NextResponse.json(
        { error: locale === "ko" ? "조정할 항목이 없습니다." : "No adjustments provided." },
        { status: 400 },
      );
    }

    const result = await db.transaction(async (tx) => {
      const applied = await applyManualRuntimeAdjustment({ tx, userId, planId, adjustments });
      if (applied.applied) {
        await invalidateStatsCacheForUser(userId, tx);
      }
      return applied;
    });

    if (!result.applied) {
      const reason = result.reason;
      if (reason === "skip:forbidden-plan") {
        return NextResponse.json(
          { error: locale === "ko" ? "권한이 없습니다." : "Forbidden." },
          { status: 403 },
        );
      }
      if (reason === "skip:no-plan") {
        return NextResponse.json(
          { error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." },
          { status: 404 },
        );
      }
      if (reason === "skip:no-applied-log") {
        return NextResponse.json(
          {
            error:
              locale === "ko"
                ? "수행 기록이 없어 현재 TM을 조정할 수 없습니다. 먼저 1회 이상 수행하세요."
                : "No workout has been applied yet — perform at least one session before adjusting.",
          },
          { status: 409 },
        );
      }
      // skip:disabled / no-root-program / version-missing / template-missing /
      // unsupported-program / no-adjustments
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? "이 플랜은 현재 TM 조정을 지원하지 않습니다."
              : "This plan does not support current-TM adjustment.",
        },
        { status: 400 },
      );
    }

    const lastByTarget = await readLastTargetEvents(planId);
    const stateTargets =
      result.state && typeof result.state === "object"
        ? ((result.state as { targets?: Record<string, { progressionTarget?: string }> }).targets ?? {})
        : {};
    const targetsLastEvent: Record<string, LastTargetEvent> = {};
    for (const [key, target] of Object.entries(stateTargets)) {
      const pt = String(target?.progressionTarget ?? key).toUpperCase();
      targetsLastEvent[key] = lastByTarget.get(pt) ?? { lastDeltaKg: null, lastEventType: null };
    }

    return NextResponse.json({ ok: true, state: result.state, targetsLastEvent }, { status: 200 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const POST = withApiLogging(POSTImpl);
