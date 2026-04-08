export type BaseFilterOption = {
  id: string;
  name: string;
};

export type ExerciseOption = {
  id: string;
  name: string;
  searchText: string;
};

export type PlanOption = {
  id: string;
  name: string;
  searchText: string;
};

export type E1RMPoint = {
  date: string;
  e1rm: number;
  weightKg: number;
  reps: number;
};

export type E1RMResponse = {
  from: string;
  to: string;
  rangeDays: number;
  exercise: string | null;
  exerciseId: string | null;
  best: E1RMPoint | null;
  series: E1RMPoint[];
};

export type ExercisesResponse = {
  items: Array<{
    id: string;
    name: string;
  }>;
};

export type PlansResponse = {
  items: Array<{
    id: string;
    name: string;
  }>;
};

export type SheetType = "exercise" | "range" | "program" | null;
export type RangePreset = 7 | 30 | 90 | 180 | 365 | "CUSTOM";

export type RangeFilter = {
  preset: RangePreset;
  from: string;
  to: string;
};
