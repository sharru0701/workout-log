import { db } from "@/server/db/client";
import {
  generatedSession,
  plan as planTable,
  planModule,
  planOverride,
  programTemplate,
  programVersion,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

type AccessoryPatch = {
  op: "ADD_ACCESSORY";
  value: {
    exerciseName: string;
    sets: Array<{ setNumber?: number; reps?: number; weightKg?: number; rpe?: number }>;
    order?: number;
  };
};

type ReplaceExercisePatch = {
  op: "REPLACE_EXERCISE";
  target: { blockTarget: string };
  value: { exerciseName: string };
};

type ReorderBlocksPatch = {
  op: "REORDER_BLOCKS";
  value: { order: string[] };
};

type Patch = AccessoryPatch | ReplaceExercisePatch | ReorderBlocksPatch;

function applyOverridesToSnapshot(snapshot: any, overrides: any[]) {
  snapshot.overridesApplied = snapshot.overridesApplied ?? [];

  for (const o of overrides) {
    const p = o.patch as Patch;
    if (!p || !("op" in p)) continue;

    if (p.op === "ADD_ACCESSORY") {
      snapshot.accessories = snapshot.accessories ?? [];
      snapshot.accessories.push({
        exerciseName: p.value.exerciseName,
        sets: p.value.sets ?? [],
        order: p.value.order ?? 99,
        source: { overrideId: o.id },
      });
      snapshot.overridesApplied.push({ overrideId: o.id, op: p.op });
      continue;
    }

    if (p.op === "REPLACE_EXERCISE") {
      const tgt = (p as any).target?.blockTarget;
      if (tgt && Array.isArray(snapshot.blocks)) {
        const block = snapshot.blocks.find((b: any) => b.target === tgt);
        if (block) {
          block.replacements = block.replacements ?? {};
          block.replacements.mainExercise = p.value.exerciseName;
          block.replacements.source = { overrideId: o.id };
          snapshot.overridesApplied.push({ overrideId: o.id, op: p.op, target: tgt });
        }
      }
      continue;
    }

    if (p.op === "REORDER_BLOCKS") {
      const order = (p as any).value?.order;
      if (Array.isArray(order) && Array.isArray(snapshot.blocks)) {
        const map = new Map(snapshot.blocks.map((b: any) => [b.target, b]));
        const reordered = order.map((k: string) => map.get(k)).filter(Boolean);
        const remaining = snapshot.blocks.filter((b: any) => !order.includes(b.target));
        snapshot.blocks = [...reordered, ...remaining];
        snapshot.overridesApplied.push({ overrideId: o.id, op: p.op });
      }
      continue;
    }
  }

  if (Array.isArray(snapshot.accessories)) {
    snapshot.accessories.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99));
  }

  return snapshot;
}

function pickManualSession(definition: any, sessionKey: string) {
  if (!definition || definition.kind !== "manual") return null;
  const sessions = Array.isArray(definition.sessions) ? definition.sessions : [];
  return sessions.find((s: any) => s.key === sessionKey) ?? null;
}

/**
 * Snapshot format (v0.2)
 * - COMPOSITE/SINGLE: blocks[]
 * - MANUAL: manualSession (selected from definition.sessions via plan.params.schedule)
 */
export async function generateAndSaveSession(input: {
  userId: string;
  planId: string;
  week: number;
  day: number;
}) {
  const sessionKey = `W${input.week}D${input.day}`;

  const pRows = await db.select().from(planTable).where(eq(planTable.id, input.planId)).limit(1);
  const p = pRows[0];
  if (!p) throw new Error("Plan not found");
  if (p.userId !== input.userId) throw new Error("Forbidden");

  // v0: SESSION scope overrides only
  const overrides = await db
    .select()
    .from(planOverride)
    .where(
      and(
        eq(planOverride.planId, p.id),
        eq(planOverride.scope, "SESSION"),
        eq(planOverride.sessionKey, sessionKey),
      ),
    );

  let snapshot: any = {
    schemaVersion: 2,
    sessionKey,
    week: input.week,
    day: input.day,
    plan: { id: p.id, type: p.type, name: p.name },
  };

  if (p.type === "COMPOSITE") {
    const modules = await db.select().from(planModule).where(eq(planModule.planId, p.id));

    const blocks = await Promise.all(
      modules
        .slice()
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map(async (m) => {
          const v = await db
            .select()
            .from(programVersion)
            .where(eq(programVersion.id, m.programVersionId))
            .limit(1);
          const version = v[0];
          if (!version) throw new Error("Program version not found");

          const t = await db
            .select()
            .from(programTemplate)
            .where(eq(programTemplate.id, version.templateId))
            .limit(1);
          const template = t[0];
          if (!template) throw new Error("Program template not found");

          return {
            target: m.target,
            program: {
              slug: template.slug,
              name: template.name,
              type: template.type,
              version: version.version,
            },
            definition: version.definition,
            params: m.params ?? {},
          };
        }),
    );

    snapshot.blocks = blocks;
    snapshot = applyOverridesToSnapshot(snapshot, overrides);
  } else {
    // SINGLE / MANUAL
    if (!p.rootProgramVersionId) throw new Error("rootProgramVersionId missing");

    const v = await db
      .select()
      .from(programVersion)
      .where(eq(programVersion.id, p.rootProgramVersionId))
      .limit(1);
    const version = v[0];
    if (!version) throw new Error("Program version not found");

    const t = await db
      .select()
      .from(programTemplate)
      .where(eq(programTemplate.id, version.templateId))
      .limit(1);
    const template = t[0];
    if (!template) throw new Error("Program template not found");

    if (p.type === "MANUAL") {
      const schedule = Array.isArray((p.params as any)?.schedule) ? (p.params as any).schedule : [];
      const chosenKey = schedule[input.day - 1] ?? schedule[(input.day - 1) % schedule.length];
      if (!chosenKey) {
        snapshot.manualSession = null;
        snapshot.manualError = "No schedule entry for this day. Provide plan.params.schedule.";
      } else {
        snapshot.manualSessionKey = chosenKey;
        snapshot.manualSession = pickManualSession(version.definition, chosenKey);
        if (!snapshot.manualSession) {
          snapshot.manualError = `Manual session '${chosenKey}' not found in program definition`;
        }
      }

      snapshot.program = {
        slug: template.slug,
        name: template.name,
        type: template.type,
        version: version.version,
      };

      snapshot = applyOverridesToSnapshot(snapshot, overrides);
    } else {
      snapshot.blocks = [
        {
          target: "CUSTOM",
          program: {
            slug: template.slug,
            name: template.name,
            type: template.type,
            version: version.version,
          },
          definition: version.definition,
          params: p.params ?? {},
        },
      ];
      snapshot = applyOverridesToSnapshot(snapshot, overrides);
    }
  }

  const existing = await db
    .select()
    .from(generatedSession)
    .where(and(eq(generatedSession.planId, p.id), eq(generatedSession.sessionKey, sessionKey)))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(generatedSession)
      .set({ snapshot, updatedAt: new Date() })
      .where(eq(generatedSession.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(generatedSession)
    .values({
      planId: p.id,
      userId: input.userId,
      sessionKey,
      snapshot,
    })
    .returning();

  return created;
}
