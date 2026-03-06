import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyExerciseDraft,
  extractOneRmTargetsFromTemplate,
  inferSessionDraftsFromTemplate,
  isOperatorTemplate,
  resolveOperatorExerciseDefaults,
  toManualDefinition,
  type ProgramTemplate,
} from "./model";

const operatorTemplate: ProgramTemplate = {
  id: "template-operator",
  slug: "operator",
  name: "Tactical Barbell Operator (Base)",
  type: "LOGIC",
  visibility: "PUBLIC",
  description: null,
  tags: ["operator"],
  latestVersion: {
    id: "version-operator",
    version: 1,
    definition: {
      kind: "operator",
      schedule: { weeks: 6, sessionsPerWeek: 3 },
      modules: ["SQUAT", "BENCH", "DEADLIFT"],
    },
    defaults: {},
  },
};

test("isOperatorTemplate detects operator logic templates", () => {
  assert.equal(isOperatorTemplate(operatorTemplate), true);
});

test("inferSessionDraftsFromTemplate returns operator day structure", () => {
  const sessions = inferSessionDraftsFromTemplate(operatorTemplate);
  assert.deepEqual(
    sessions.map((session) => ({
      key: session.key,
      exercises: session.exercises.map((exercise) => exercise.exerciseName),
    })),
    [
      { key: "D1", exercises: ["Back Squat", "Bench Press", "Pull-Up"] },
      { key: "D2", exercises: ["Back Squat", "Bench Press", "Pull-Up"] },
      { key: "D3", exercises: ["Back Squat", "Bench Press", "Deadlift"] },
    ],
  );
});

test("toManualDefinition preserves operator markers and auto/custom row metadata", () => {
  const sessions = inferSessionDraftsFromTemplate(operatorTemplate);
  const definition = toManualDefinition(sessions, {
    operatorStyle: true,
    programFamily: "operator",
  });

  assert.equal(definition.operatorStyle, true);
  assert.equal(definition.programFamily, "operator");
  assert.equal(definition.sessions[0]?.items[0]?.rowType, "AUTO");
  assert.equal(definition.sessions[0]?.items[0]?.progressionTarget, "SQUAT");
  assert.equal(definition.sessions[0]?.items[2]?.rowType, "AUTO");
  assert.equal(definition.sessions[0]?.items[2]?.progressionTarget, "PULL");
});

test("inferSessionDraftsFromTemplate prefers saved manual operator sessions over default slots", () => {
  const savedTemplate: ProgramTemplate = {
    ...operatorTemplate,
    slug: "operator-custom",
    visibility: "PRIVATE",
    latestVersion: {
      ...operatorTemplate.latestVersion!,
      definition: {
        kind: "manual",
        operatorStyle: true,
        programFamily: "operator",
        sessions: [
          {
            key: "D1",
            items: [
              {
                exerciseName: "Back Squat",
                rowType: "AUTO",
                progressionTarget: "SQUAT",
                sets: [{ reps: 5, targetWeightKg: 0 }],
              },
              {
                exerciseName: "Bench Press",
                rowType: "AUTO",
                progressionTarget: "BENCH",
                sets: [{ reps: 5, targetWeightKg: 0 }],
              },
            ],
          },
          {
            key: "D2",
            items: [],
          },
          {
            key: "D3",
            items: [
              {
                exerciseName: "Romanian Deadlift",
                rowType: "AUTO",
                progressionTarget: "DEADLIFT",
                sets: [{ reps: 5, targetWeightKg: 0 }],
              },
            ],
          },
        ],
      },
    },
  };

  const sessions = inferSessionDraftsFromTemplate(savedTemplate);
  assert.deepEqual(
    sessions.map((session) => ({
      key: session.key,
      exercises: session.exercises.map((exercise) => exercise.exerciseName),
    })),
    [
      { key: "D1", exercises: ["Back Squat", "Bench Press"] },
      { key: "D2", exercises: [] },
      { key: "D3", exercises: ["Romanian Deadlift"] },
    ],
  );
});

test("extractOneRmTargetsFromTemplate keeps operator manual auto slots per exercise", () => {
  const savedTemplate: ProgramTemplate = {
    ...operatorTemplate,
    slug: "operator-custom-targets",
    visibility: "PRIVATE",
    latestVersion: {
      ...operatorTemplate.latestVersion!,
      definition: {
        kind: "manual",
        operatorStyle: true,
        programFamily: "operator",
        sessions: [
          {
            key: "D1",
            items: [
              { exerciseName: "Back Squat", rowType: "AUTO", progressionTarget: "SQUAT", sets: [{ reps: 5, targetWeightKg: 0 }] },
              { exerciseName: "Bench Press", rowType: "AUTO", progressionTarget: "BENCH", sets: [{ reps: 5, targetWeightKg: 0 }] },
              { exerciseName: "Pull-Up", rowType: "AUTO", progressionTarget: "PULL", sets: [{ reps: 5, targetWeightKg: 0 }] },
            ],
          },
          {
            key: "D2",
            items: [
              { exerciseName: "Barbell Row", rowType: "AUTO", progressionTarget: "PULL", sets: [{ reps: 5, targetWeightKg: 0 }] },
              { exerciseName: "Face Pull", rowType: "CUSTOM", sets: [{ reps: 15, targetWeightKg: 0 }] },
            ],
          },
          {
            key: "D3",
            items: [
              { exerciseName: "Romanian Deadlift", rowType: "AUTO", progressionTarget: "DEADLIFT", sets: [{ reps: 5, targetWeightKg: 0 }] },
            ],
          },
        ],
      },
    },
  };

  assert.deepEqual(
    extractOneRmTargetsFromTemplate(savedTemplate).map((target) => ({
      key: target.key,
      label: target.label,
      fallbackKey: target.fallbackKey ?? null,
    })),
    [
      { key: "EX_BACK_SQUAT", label: "Back Squat", fallbackKey: "SQUAT" },
      { key: "EX_BENCH_PRESS", label: "Bench Press", fallbackKey: "BENCH" },
      { key: "EX_PULL_UP", label: "Pull-Up", fallbackKey: "PULL" },
      { key: "EX_BARBELL_ROW", label: "Barbell Row", fallbackKey: "PULL" },
      { key: "EX_ROMANIAN_DEADLIFT", label: "Romanian Deadlift", fallbackKey: "DEADLIFT" },
    ],
  );
});

test("resolveOperatorExerciseDefaults returns operator main defaults", () => {
  assert.deepEqual(resolveOperatorExerciseDefaults("Pull-Up", "AUTO"), { sets: 3, reps: 5 });
  assert.deepEqual(resolveOperatorExerciseDefaults("Bench Press", "AUTO"), { sets: 3, reps: 5 });
  assert.deepEqual(resolveOperatorExerciseDefaults("Face Pull", "CUSTOM"), { sets: 3, reps: 8 });
});

test("createEmptyExerciseDraft uses operator defaults when auto row type is provided", () => {
  const operatorDraft = createEmptyExerciseDraft(null, "AUTO");
  const customOperatorDraft = createEmptyExerciseDraft(null, "CUSTOM");
  const genericDraft = createEmptyExerciseDraft();

  assert.equal(operatorDraft.sets, 3);
  assert.equal(operatorDraft.reps, 5);
  assert.equal(customOperatorDraft.sets, 3);
  assert.equal(customOperatorDraft.reps, 8);
  assert.equal(genericDraft.sets, 3);
  assert.equal(genericDraft.reps, 8);
});

test("inferSessionDraftsFromTemplate reads legacy slot roles as auto rows", () => {
  const savedTemplate: ProgramTemplate = {
    ...operatorTemplate,
    slug: "operator-legacy",
    visibility: "PRIVATE",
    latestVersion: {
      ...operatorTemplate.latestVersion!,
      definition: {
        kind: "manual",
        operatorStyle: true,
        programFamily: "operator",
        sessions: [
          {
            key: "D1",
            items: [
              { exerciseName: "Back Squat", slotRole: "ANCHOR", sets: [{ reps: 5, targetWeightKg: 0 }] },
              { exerciseName: "Pull-Up", slotRole: "FLEX", sets: [{ reps: 5, targetWeightKg: 0 }] },
              { exerciseName: "Reverse Fly", slotRole: "CUSTOM", sets: [{ reps: 15, targetWeightKg: 0 }] },
            ],
          },
        ],
      },
    },
  };

  const [session] = inferSessionDraftsFromTemplate(savedTemplate);

  assert.equal(session?.exercises[0]?.rowType, "AUTO");
  assert.equal(session?.exercises[0]?.progressionTarget, "SQUAT");
  assert.equal(session?.exercises[1]?.rowType, "AUTO");
  assert.equal(session?.exercises[1]?.progressionTarget, "PULL");
  assert.equal(session?.exercises[2]?.rowType, "CUSTOM");
});
