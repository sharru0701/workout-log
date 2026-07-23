import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  programDefinitionSchema,
  parseProgramDefinition,
  manualDefinitionSchema,
} from "./schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputsPath = path.resolve(here, "../../fixtures/dsl/inputs.json");

type InputEntry = { slug: string; type: string; kind: string | null; definition: unknown };

test("every real DB definition (fixtures/dsl/inputs.json) parses", () => {
  const inputs = JSON.parse(fs.readFileSync(inputsPath, "utf8")) as InputEntry[];
  assert.ok(inputs.length >= 18, "expected the dumped inventory");

  const seenKinds = new Set<string>();
  for (const entry of inputs) {
    const parsed = parseProgramDefinition(entry.definition);
    assert.ok(
      parsed.ok,
      `definition for "${entry.slug}" (kind=${entry.kind}) failed to parse`,
    );
    assert.equal(parsed.kind, entry.kind, `kind mismatch for ${entry.slug}`);
    if (entry.kind) seenKinds.add(entry.kind);
  }
  // The 5 real kinds from the inventory must all be represented.
  for (const k of ["manual", "operator", "531", "ref5", "asymptote"]) {
    assert.ok(seenKinds.has(k), `fixture missing kind ${k}`);
  }
});

test("fork-only fields are accepted and preserved (operatorStyle, setNumber)", () => {
  // Shape observed only on prod (a user's forked operator materialized to manual).
  const forked = {
    kind: "manual",
    programFamily: "operator",
    operatorStyle: true,
    sessions: [
      {
        key: "D1",
        items: [
          {
            exerciseName: "Squat",
            progressionTarget: "SQUAT",
            sets: [{ reps: 5, targetWeightKg: 100, setNumber: 1 }],
          },
        ],
      },
    ],
  };
  const parsed = manualDefinitionSchema.parse(forked);
  assert.equal(parsed.operatorStyle, true);
  assert.equal(parsed.sessions[0]!.items[0]!.sets![0]!.setNumber, 1);
});

test("synonyms parse (weightKg / name) and unknown keys survive passthrough", () => {
  const legacy = {
    kind: "manual",
    sessions: [{ key: "A", items: [{ name: "Bench", sets: [{ reps: 5, weightKg: 60, futureField: 1 }] }] }],
  };
  const parsed = manualDefinitionSchema.parse(legacy) as Record<string, any>;
  assert.equal(parsed.sessions[0].items[0].name, "Bench");
  assert.equal(parsed.sessions[0].items[0].sets[0].weightKg, 60);
  assert.equal(parsed.sessions[0].items[0].sets[0].futureField, 1); // passthrough kept it
});

test("unknown / malformed kinds fall back instead of throwing", () => {
  const unknown = parseProgramDefinition({ kind: "candito-linear", schedule: {} });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok === false && unknown.kind, "candito-linear");

  const nullish = parseProgramDefinition(null);
  assert.equal(nullish.ok, false);
  assert.equal(nullish.ok === false && nullish.kind, null);

  // safeParse never throws for the union either.
  assert.equal(programDefinitionSchema.safeParse({ kind: "nope" }).success, false);
});
