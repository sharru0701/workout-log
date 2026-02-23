import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercise, exerciseAlias } from "@/server/db/schema";

export type ResolvedExercise = {
  id: string;
  name: string;
};

export async function resolveExerciseByName(raw: string): Promise<ResolvedExercise | null> {
  const name = raw.trim();
  if (!name) return null;

  const direct = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exercise)
    .where(eq(exercise.name, name))
    .limit(1);
  if (direct[0]) return direct[0];

  const aliasDirect = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exerciseAlias)
    .innerJoin(exercise, eq(exerciseAlias.exerciseId, exercise.id))
    .where(eq(exerciseAlias.alias, name))
    .limit(1);
  if (aliasDirect[0]) return aliasDirect[0];

  const directCi = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exercise)
    .where(sql`lower(${exercise.name}) = lower(${name})`)
    .limit(1);
  if (directCi[0]) return directCi[0];

  const aliasCi = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exerciseAlias)
    .innerJoin(exercise, eq(exerciseAlias.exerciseId, exercise.id))
    .where(sql`lower(${exerciseAlias.alias}) = lower(${name})`)
    .limit(1);
  if (aliasCi[0]) return aliasCi[0];

  return null;
}

export async function getExerciseById(id: string): Promise<ResolvedExercise | null> {
  const rows = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exercise)
    .where(eq(exercise.id, id))
    .limit(1);
  return rows[0] ?? null;
}
