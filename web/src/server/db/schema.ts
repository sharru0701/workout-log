import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Enums
 */
export const programType = pgEnum("program_type", ["LOGIC", "MANUAL"]);
export const visibilityType = pgEnum("visibility_type", ["PUBLIC", "PRIVATE"]);

export const planType = pgEnum("plan_type", ["SINGLE", "COMPOSITE", "MANUAL"]);
export const moduleTarget = pgEnum("module_target", [
  "SQUAT",
  "BENCH",
  "DEADLIFT",
  "OHP",
  "PULL",
  "CUSTOM",
]);

export const overrideScope = pgEnum("override_scope", [
  "PLAN",
  "WEEK",
  "SESSION",
  "EXERCISE",
]);

export const sessionStatus = pgEnum("session_status", ["PLANNED", "DONE", "SKIPPED"]);

/**
 * program_template: top-level template definition (e.g., 5/3/1, Operator, Candito, Manual)
 *
 * Fork support:
 * - ownerUserId: for PRIVATE templates
 * - parentTemplateId: points to the original template if this is a fork
 */
export const programTemplate = pgTable(
  "program_template",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    slug: text("slug").notNull(), // stable identifier, e.g. "531", "operator"
    name: text("name").notNull(),
    type: programType("type").notNull(),
    visibility: visibilityType("visibility").notNull().default("PUBLIC"),

    // fork/ownership
    ownerUserId: text("owner_user_id"),
    parentTemplateId: uuid("parent_template_id"),

    description: text("description"),
    tags: text("tags").array(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugUnique: uniqueIndex("program_template_slug_uq").on(t.slug),
    typeIdx: index("program_template_type_idx").on(t.type),
    ownerIdx: index("program_template_owner_idx").on(t.ownerUserId),
  }),
);

/**
 * program_version: versioned definition (DSL JSON for LOGIC, fixed sessions JSON for MANUAL)
 *
 * Fork support:
 * - parentVersionId: points to the version that was forked
 */
export const programVersion = pgTable(
  "program_version",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    templateId: uuid("template_id")
      .notNull()
      .references(() => programTemplate.id, { onDelete: "cascade" }),

    version: integer("version").notNull(), // 1,2,3...
    changelog: text("changelog"),

    // fork lineage
    parentVersionId: uuid("parent_version_id"),

    // definition JSONB:
    // - LOGIC: DSL describing generation rules
    // - MANUAL: explicit sessions/exercises/sets structure
    definition: jsonb("definition").notNull(),

    // optional: default parameters (TM, 1RM, schedule options)
    defaults: jsonb("defaults"),

    isDeprecated: boolean("is_deprecated").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    templateVersionUq: uniqueIndex("program_version_template_version_uq").on(t.templateId, t.version),
    templateIdx: index("program_version_template_idx").on(t.templateId),
  }),
);

/**
 * plan: user's instance of a program or composite of modules
 */
export const plan = pgTable(
  "plan",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    name: text("name").notNull(),
    type: planType("type").notNull(),

    // root program version for SINGLE/MANUAL
    rootProgramVersionId: uuid("root_program_version_id").references(() => programVersion.id, {
      onDelete: "restrict",
    }),

    // plan-level parameters (e.g., schedule preferences, training maxes)
    params: jsonb("params").notNull().default({}),

    isArchived: boolean("is_archived").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("plan_user_idx").on(t.userId),
    typeIdx: index("plan_type_idx").on(t.type),
  }),
);

/**
 * plan_module: for COMPOSITE plans, mapping each target lift/module to a program version.
 */
export const planModule = pgTable(
  "plan_module",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),

    target: moduleTarget("target").notNull(),

    programVersionId: uuid("program_version_id")
      .notNull()
      .references(() => programVersion.id, { onDelete: "restrict" }),

    priority: integer("priority").notNull().default(0),

    params: jsonb("params").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    planTargetUq: uniqueIndex("plan_module_plan_target_uq").on(t.planId, t.target),
    planIdx: index("plan_module_plan_idx").on(t.planId),
  }),
);

/**
 * plan_override: store changes as JSON patch-like document.
 */
export const planOverride = pgTable(
  "plan_override",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),

    scope: overrideScope("scope").notNull(),

    weekNumber: integer("week_number"),
    sessionKey: text("session_key"),

    patch: jsonb("patch").notNull(),

    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    planScopeIdx: index("plan_override_plan_scope_idx").on(t.planId, t.scope),
    planWeekIdx: index("plan_override_plan_week_idx").on(t.planId, t.weekNumber),
  }),
);

/**
 * generated_session: materialized/snapshotted planned session
 */
export const generatedSession = pgTable(
  "generated_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),

    userId: text("user_id").notNull(),

    sessionKey: text("session_key").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),

    status: sessionStatus("status").notNull().default("PLANNED"),

    snapshot: jsonb("snapshot").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("generated_session_user_idx").on(t.userId),
    planIdx: index("generated_session_plan_idx").on(t.planId),
    planSessionUq: uniqueIndex("generated_session_plan_session_uq").on(t.planId, t.sessionKey),
  }),
);

/**
 * workout_log: 실제 수행 기록
 */
export const workoutLog = pgTable(
  "workout_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    planId: uuid("plan_id").references(() => plan.id, { onDelete: "set null" }),
    generatedSessionId: uuid("generated_session_id").references(() => generatedSession.id, {
      onDelete: "set null",
    }),

    performedAt: timestamp("performed_at", { withTimezone: true }).defaultNow().notNull(),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    tags: text("tags").array(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userPerformedIdx: index("workout_log_user_performed_idx").on(t.userId, t.performedAt),
    planIdx: index("workout_log_plan_idx").on(t.planId),
    sessionIdx: index("workout_log_generated_session_idx").on(t.generatedSessionId),
  }),
);

/**
 * workout_set: 정규화된 세트 이벤트
 */
export const workoutSet = pgTable(
  "workout_set",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    logId: uuid("log_id")
      .notNull()
      .references(() => workoutLog.id, { onDelete: "cascade" }),

    exerciseName: text("exercise_name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),

    setNumber: integer("set_number").notNull().default(1),
    reps: integer("reps"),
    weightKg: integer("weight_kg"),
    rpe: integer("rpe"),
    isExtra: boolean("is_extra").notNull().default(false),

    meta: jsonb("meta").notNull().default({}),
  },
  (t) => ({
    logIdx: index("workout_set_log_idx").on(t.logId),
    exerciseIdx: index("workout_set_exercise_idx").on(t.exerciseName),
  }),
);