import type { ProgramTemplate } from "@workout/core/program-store/model";

export type PlanItem = {
  id: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  rootProgramVersionId: string | null;
  params: Record<string, unknown> | null;
  /** GET /api/plans가 함께 내려주는 진행 요약 — 재시작 시트의 "이어서 하기" 카드가 쓴다. */
  lastPerformedAt?: string | null;
};

export type ExerciseOption = {
  id: string;
  name: string;
  category: string | null;
};

export type TemplatesResponse = {
  items: ProgramTemplate[];
};

export type PlansResponse = {
  items: PlanItem[];
};

export type ExerciseResponse = {
  items: ExerciseOption[];
};

export type ProgramStoreQueryState = {
  detail: string;
  customize: string;
  create: string;
};
