import { Hono } from "hono";

import { db } from "@/server/db/client";
import { and, desc, eq, inArray, isNotNull, or } from "@/server/db/ops";
import {
  generatedSession,
  plan as planTable,
  planModule,
  planOverride,
  programTemplate,
  programVersion,
  workoutLog,
} from "@/server/db/schema";
import { generateAndSaveSession } from "@/server/program-engine/generateSession";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";

import { requireAuth, type AppEnv } from "../auth";
import { apiError, resolveLocale } from "../lib/http";

// ─────────────────────────────────────────────────────────────────────────────
// Plans — the TUI-critical plan workflow (list/create/rename/delete/generate/
// overrides), ported verbatim from web/src/app/api/plans/**. Logic stays inline
// (or calls the Next-free program-engine for generate). requireAuth supplies the
// user id. Deferred to a later sub-group (TUI-unused): progression-state,
// runtime-targets, cycle-overview.
// ─────────────────────────────────────────────────────────────────────────────

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function withAutoProgressionDefaults(value: unknown) {
  const next = { ...toRecord(value) };
  next.autoProgression = true;
  return next;
}

const PROGRESSION_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function snapTo2p5(n: number): number {
  return Math.max(0, Math.round(n / 2.5) * 2.5);
}

type NormalizedIncrementOverrides = {
  increaseKg?: Record<string, number>;
  decreaseKg?: Record<string, number>;
};

function validateIncrementOverrides(
  value: unknown,
  locale: "ko" | "en",
):
  | { ok: true; value: NormalizedIncrementOverrides | null }
  | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: null };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error:
        locale === "ko"
          ? "incrementOverrides는 객체여야 합니다."
          : "incrementOverrides must be an object.",
    };
  }

  const out: NormalizedIncrementOverrides = {};
  for (const side of ["increaseKg", "decreaseKg"] as const) {
    const raw = (value as Record<string, unknown>)[side];
    if (raw === undefined) continue;
    if (raw === null) continue;
    if (typeof raw !== "object" || Array.isArray(raw)) {
      return {
        ok: false,
        error:
          locale === "ko"
            ? `incrementOverrides.${side}는 객체여야 합니다.`
            : `incrementOverrides.${side} must be an object.`,
      };
    }
    const normalized: Record<string, number> = {};
    for (const [rawKey, rawValue] of Object.entries(raw)) {
      const key = String(rawKey).trim().toUpperCase();
      if (!PROGRESSION_KEY_PATTERN.test(key)) continue;
      const num = Number(rawValue);
      if (!Number.isFinite(num) || num < 0) {
        return {
          ok: false,
          error:
            locale === "ko"
              ? `${key}의 ${side} 값은 0 이상의 숫자여야 합니다.`
              : `${key} ${side} must be a non-negative number.`,
        };
      }
      normalized[key] = snapTo2p5(num);
    }
    if (Object.keys(normalized).length > 0) {
      out[side] = normalized;
    }
  }

  if (!out.increaseKg && !out.decreaseKg) return { ok: true, value: null };
  return { ok: true, value: out };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export const plansRoutes = new Hono<AppEnv>();

plansRoutes.use("*", requireAuth);

// GET /api/plans — the user's plans, each with baseProgramName + lastPerformedAt.
plansRoutes.get("/", async (c) => {
  const locale = resolveLocale(c);
  try {
    const userId = c.get("userId");

    const baseItems = await db
      .select()
      .from(planTable)
      .where(eq(planTable.userId, userId))
      .orderBy(desc(planTable.createdAt));

    if (baseItems.length === 0) {
      return c.json({ items: [] });
    }

    const rootVersionIds = Array.from(
      new Set(
        baseItems
          .map((item) => item.rootProgramVersionId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const planIds = baseItems.map((item) => item.id);
    const [versionRows, logRows] = await Promise.all([
      rootVersionIds.length > 0
        ? db
            .select({ versionId: programVersion.id, templateName: programTemplate.name })
            .from(programVersion)
            .leftJoin(programTemplate, eq(programTemplate.id, programVersion.templateId))
            .where(inArray(programVersion.id, rootVersionIds))
        : Promise.resolve([] as Array<{ versionId: string; templateName: string | null }>),
      db
        .select({ planId: workoutLog.planId, performedAt: workoutLog.performedAt })
        .from(workoutLog)
        .where(
          and(
            eq(workoutLog.userId, userId),
            isNotNull(workoutLog.planId),
            inArray(workoutLog.planId, planIds),
          ),
        )
        .orderBy(desc(workoutLog.performedAt)),
    ]);

    const versionNameById = new Map<string, string>();
    for (const row of versionRows) {
      if (!row.versionId) continue;
      const label = String(row.templateName ?? "").trim();
      if (!label) continue;
      versionNameById.set(row.versionId, label);
    }
    const lastPerformedAtByPlanId = new Map<string, Date>();
    for (const row of logRows) {
      const planId = row.planId;
      if (!planId) continue;
      if (lastPerformedAtByPlanId.has(planId)) continue;
      lastPerformedAtByPlanId.set(planId, row.performedAt);
    }

    const items = baseItems.map((item) => {
      const baseProgramName =
        (item.rootProgramVersionId && versionNameById.get(item.rootProgramVersionId)) ??
        (item.type === "COMPOSITE"
          ? locale === "ko"
            ? "복합 플랜"
            : "Composite Plan"
          : locale === "ko"
            ? "프로그램 정보 없음"
            : "No Program Info");
      return {
        ...item,
        baseProgramName,
        lastPerformedAt: lastPerformedAtByPlanId.get(item.id) ?? null,
      };
    });

    c.header("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return c.json({ items });
  } catch (e) {
    return apiError(c, e, locale);
  }
});

// POST /api/plans — create a SINGLE / MANUAL / COMPOSITE plan.
plansRoutes.post("/", async (c) => {
  const locale = resolveLocale(c);
  try {
    const body = await c.req.json();
    const userId = c.get("userId");
    const name = body.name;
    const type = body.type;

    if (!name || !type) {
      return c.json(
        { error: locale === "ko" ? "name과 type이 필요합니다." : "name and type are required." },
        400,
      );
    }

    if (type === "COMPOSITE") {
      const modules = Array.isArray(body.modules) ? body.modules : [];
      if (modules.length === 0) {
        return c.json(
          {
            error:
              locale === "ko"
                ? "COMPOSITE 플랜에는 modules가 필요합니다."
                : "modules are required for COMPOSITE.",
          },
          400,
        );
      }

      const created = await db.transaction(async (tx) => {
        const [p] = await tx
          .insert(planTable)
          .values({ userId, name, type, params: withAutoProgressionDefaults(body.params) })
          .returning();

        await tx.insert(planModule).values(
          modules.map((m: any) => ({
            planId: p.id,
            target: m.target,
            programVersionId: m.programVersionId,
            priority: m.priority ?? 0,
            params: m.params ?? {},
          })),
        );

        return p;
      });

      return c.json({ plan: created }, 201);
    }

    // SINGLE or MANUAL
    const rootProgramVersionId = body.rootProgramVersionId;
    if (!rootProgramVersionId) {
      return c.json(
        {
          error:
            locale === "ko" ? "rootProgramVersionId가 필요합니다." : "rootProgramVersionId is required.",
        },
        400,
      );
    }

    const [p] = await db
      .insert(planTable)
      .values({
        userId,
        name,
        type,
        rootProgramVersionId,
        params: withAutoProgressionDefaults(body.params),
      })
      .returning();

    return c.json({ plan: p }, 201);
  } catch (e) {
    return apiError(c, e, locale);
  }
});

// PATCH /api/plans/:planId — rename / patch params (incl. autoProgression,
// incrementOverrides validation).
plansRoutes.patch("/:planId", async (c) => {
  const locale = resolveLocale(c);
  try {
    const planId = c.req.param("planId");
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
      name?: unknown;
      params?: unknown;
      autoProgression?: unknown;
    };

    const rows = await db.select().from(planTable).where(eq(planTable.id, planId)).limit(1);
    const found = rows[0];
    if (!found)
      return c.json(
        { error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." },
        404,
      );
    if (found.userId !== userId)
      return c.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, 403);

    const hasNamePatch = typeof body.name === "string";
    const nextName = hasNamePatch ? String(body.name).trim() : "";
    if (hasNamePatch && !nextName) {
      return c.json(
        {
          error:
            locale === "ko" ? "플랜 이름은 비워둘 수 없습니다." : "Plan name must not be empty.",
        },
        400,
      );
    }
    const hasParamsPatch =
      (body.params !== undefined &&
        body.params !== null &&
        typeof body.params === "object" &&
        !Array.isArray(body.params)) ||
      typeof body.autoProgression === "boolean";
    if (!hasNamePatch && !hasParamsPatch) {
      return c.json(
        { error: locale === "ko" ? "수정할 내용이 없습니다." : "No patch payload." },
        400,
      );
    }

    const currentParams = asRecord(found.params);
    const paramPatch = asRecord(body.params);
    const nextParams: Record<string, unknown> = { ...currentParams, ...paramPatch };

    if (Object.prototype.hasOwnProperty.call(paramPatch, "incrementOverrides")) {
      const validation = validateIncrementOverrides(paramPatch.incrementOverrides, locale);
      if (!validation.ok) {
        return c.json({ error: validation.error }, 400);
      }
      if (validation.value === null) {
        delete nextParams.incrementOverrides;
      } else {
        nextParams.incrementOverrides = validation.value;
      }
    }

    if (typeof body.autoProgression === "boolean") {
      nextParams.autoProgression = body.autoProgression;
    }

    const [updated] = await db
      .update(planTable)
      .set({
        name: hasNamePatch ? nextName : undefined,
        params: hasParamsPatch ? nextParams : undefined,
        updatedAt: new Date(),
      })
      .where(eq(planTable.id, planId))
      .returning();

    return c.json({ plan: updated }, 200);
  } catch (e) {
    return apiError(c, e, locale);
  }
});

// DELETE /api/plans/:planId — delete a plan and its logs/generated sessions.
plansRoutes.delete("/:planId", async (c) => {
  const locale = resolveLocale(c);
  try {
    const planId = c.req.param("planId");
    const userId = c.get("userId");

    const rows = await db.select().from(planTable).where(eq(planTable.id, planId)).limit(1);
    const found = rows[0];
    if (!found)
      return c.json(
        { error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." },
        404,
      );
    if (found.userId !== userId)
      return c.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, 403);

    const result = await db.transaction(async (tx) => {
      const sessionRows = await tx
        .select({ id: generatedSession.id })
        .from(generatedSession)
        .where(eq(generatedSession.planId, planId));
      const sessionIds = sessionRows.map((row) => row.id);

      const deletedLogs = await tx
        .delete(workoutLog)
        .where(
          sessionIds.length > 0
            ? or(eq(workoutLog.planId, planId), inArray(workoutLog.generatedSessionId, sessionIds))
            : eq(workoutLog.planId, planId),
        )
        .returning({ id: workoutLog.id });

      await tx.delete(planTable).where(eq(planTable.id, planId));
      await invalidateStatsCacheForUser(userId, tx);

      return {
        deletedLogCount: deletedLogs.length,
        deletedGeneratedSessionCount: sessionIds.length,
      };
    });

    return c.json(
      {
        deleted: true,
        planId,
        deletedLogCount: result.deletedLogCount,
        deletedGeneratedSessionCount: result.deletedGeneratedSessionCount,
      },
      200,
    );
  } catch (e) {
    return apiError(c, e, locale);
  }
});

// POST /api/plans/:planId/generate — generate (and save) a session for a plan.
plansRoutes.post("/:planId/generate", async (c) => {
  const locale = resolveLocale(c);
  try {
    const planId = c.req.param("planId");
    const body = await c.req.json().catch(() => ({}));
    const userId = c.get("userId");
    const rawWeek = body.week;
    const rawDay = body.day;
    const week =
      rawWeek === undefined || rawWeek === null || rawWeek === "" ? undefined : Number(rawWeek);
    const day =
      rawDay === undefined || rawDay === null || rawDay === "" ? undefined : Number(rawDay);
    const sessionDate =
      typeof body.sessionDate === "string" && body.sessionDate.trim()
        ? body.sessionDate.trim()
        : undefined;
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : undefined;

    if (
      (week !== undefined && !Number.isFinite(week)) ||
      (day !== undefined && !Number.isFinite(day))
    ) {
      return c.json(
        {
          error:
            locale === "ko"
              ? "week/day 값이 주어지면 숫자여야 합니다."
              : "week/day must be numeric when provided",
        },
        400,
      );
    }

    const session = await generateAndSaveSession({
      userId,
      planId,
      week,
      day,
      sessionDate,
      timezone,
    });

    return c.json({ session }, 201);
  } catch (e) {
    return apiError(c, e, locale);
  }
});

// POST /api/plans/:planId/overrides — create a plan override (ADD_ACCESSORY /
// REPLACE_EXERCISE; PLAN or SESSION scope).
plansRoutes.post("/:planId/overrides", async (c) => {
  const locale = resolveLocale(c);
  try {
    const planId = c.req.param("planId");
    const body = await c.req.json();
    const userId = c.get("userId");

    const planRow = await db.select().from(planTable).where(eq(planTable.id, planId)).limit(1);
    const p = planRow[0];
    if (!p)
      return c.json(
        { error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." },
        404,
      );
    if (p.userId !== userId)
      return c.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, 403);

    const scope = body.scope;
    const patch = body.patch;

    if (!scope || !patch) {
      return c.json(
        { error: locale === "ko" ? "scope와 patch가 필요합니다." : "scope and patch are required." },
        400,
      );
    }

    const [created] = await db
      .insert(planOverride)
      .values({
        planId,
        scope,
        weekNumber: body.weekNumber ?? null,
        sessionKey: body.sessionKey ?? null,
        patch,
        note: body.note ?? null,
      })
      .returning();

    return c.json({ override: created }, 201);
  } catch (e) {
    return apiError(c, e, locale);
  }
});
