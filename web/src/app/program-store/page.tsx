"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ExerciseEditorRow from "./_components/program-exercise-editor-row";
import { DashboardSection, DashboardSurface } from "@/components/dashboard/dashboard-primitives";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, isAbortError } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import {
  createEmptyExerciseDraft,
  extractOneRmTargetsFromTemplate,
  hasAtLeastOneExercise,
  inferSessionDraftsFromTemplate,
  isOperatorTemplate,
  makeForkSlug,
  makeSessionKeys,
  moveExerciseBetweenSessions,
  reconcileSessionsByKeys,
  reorderExercises,
  toManualDefinition,
  toProgramListItems,
  type ProgramExerciseDraft,
  type ProgramListItem,
  type ProgramSessionDraft,
  type ProgramTemplate,
  type SessionRule,
  type OneRmTarget,
} from "@/lib/program-store/model";

type TemplatesResponse = {
  items: ProgramTemplate[];
};

type PlanItem = {
  id: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  rootProgramVersionId: string | null;
  params: any;
};

type PlansResponse = {
  items: PlanItem[];
};

type ExerciseOption = {
  id: string;
  name: string;
  category: string | null;
};

type ExerciseResponse = {
  items: ExerciseOption[];
};

type ForkResponse = {
  template: ProgramTemplate;
  version: {
    id: string;
    version: number;
  };
};

type DragContext = {
  sourceSessionId: string;
  sourceExerciseId: string;
};

type CustomizeDraft = {
  name: string;
  baseTemplate: ProgramTemplate;
  sessions: ProgramSessionDraft[];
};

type CreateMode = "MARKET_BASED" | "FULL_MANUAL";

type CreateDraft = {
  name: string;
  mode: CreateMode;
  sourceTemplateSlug: string | null;
  rule: SessionRule;
  sessions: ProgramSessionDraft[];
};

type StartProgramDraft = {
  template: ProgramTemplate;
  expectedPlanType: "SINGLE" | "MANUAL";
  existingPlanId: string | null;
  timezone: string;
  today: string;
  tmPercent: number;
  targets: OneRmTarget[];
  oneRmInputs: Record<string, string>;
  recommendations: Record<string, OneRmRecommendation>;
  recommendationStatus: "idle" | "loading" | "ready" | "failed";
  recommendationMessage: string | null;
};

type OneRmRecommendation = {
  sourceExerciseName: string;
  latestE1rmKg: number;
  bestE1rmKg: number;
  recommendedKg: number;
  latestDate: string;
};

type PrStatsResponse = {
  items?: Array<{
    exerciseName: string;
    best?: { e1rm?: number; date?: string } | null;
    latest?: { e1rm?: number; date?: string } | null;
  }>;
};

type DeleteTemplateResponse = {
  deleted: boolean;
  template: {
    id: string;
    slug: string;
    name: string;
  };
  deletedPlanCount: number;
};

function todayKeyInTimezone(timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((entry) => entry.type === "year")?.value ?? "1970";
  const m = parts.find((entry) => entry.type === "month")?.value ?? "01";
  const d = parts.find((entry) => entry.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function toContextLabel(item: ProgramListItem) {
  return `${formatProgramDisplayName(item.name)} / ${item.subtitle}`;
}

function formatProgramDisplayName(name: string) {
  return String(name)
    .replace(/\s*\(base[^)]*\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sourceBadgeMeta(source: ProgramListItem["source"]) {
  if (source === "CUSTOM") {
    return { label: "Custom", className: "ui-badge-warning" };
  }
  return { label: "Base", className: "ui-badge-info" };
}

function parseSearchValue(value: string | string[] | null) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readSearchQueryFromLocation() {
  if (typeof window === "undefined") {
    return {
      detail: "",
      customize: "",
      create: "",
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    detail: params.get("detail") ?? "",
    customize: params.get("customize") ?? "",
    create: params.get("create") ?? "",
  };
}

function buildInitialCreateDraft(templates: ProgramTemplate[]): CreateDraft {
  const sourceTemplate = templates.find((template) => template.visibility === "PUBLIC") ?? templates[0] ?? null;
  const initialRule: SessionRule = { type: "AB", count: 2 };
  const keys = makeSessionKeys(initialRule);

  return {
    name: "",
    mode: sourceTemplate ? "MARKET_BASED" : "FULL_MANUAL",
    sourceTemplateSlug: sourceTemplate?.slug ?? null,
    rule: initialRule,
    sessions: keys.map((key) => ({
      id: `${key}-${Date.now()}`,
      key,
      exercises: [],
    })),
  };
}

function exerciseValidity(exercise: ProgramExerciseDraft) {
  if (exercise.rowType === "AUTO") {
    return exercise.exerciseName.trim().length > 0 && Boolean(exercise.progressionTarget);
  }
  return exercise.exerciseName.trim().length > 0 && exercise.sets > 0 && exercise.reps > 0;
}

function validateCustomSessions(sessions: ProgramSessionDraft[]) {
  const errors: string[] = [];
  if (!hasAtLeastOneExercise(sessions)) {
    errors.push("최소 1개 운동을 추가해야 합니다.");
  }
  sessions.forEach((session) => {
    session.exercises.forEach((exercise, index) => {
      if (!exerciseValidity(exercise)) {
        errors.push(`세션 ${session.key}의 ${index + 1}번째 운동 입력값을 확인하세요.`);
      }
    });
  });
  return errors;
}

function patchExerciseInSessions(
  sessions: ProgramSessionDraft[],
  sessionId: string,
  exerciseId: string,
  patch: Partial<ProgramExerciseDraft>,
) {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    return {
      ...session,
      exercises: session.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
      ),
    };
  });
}

function deleteExerciseFromSessions(
  sessions: ProgramSessionDraft[],
  sessionId: string,
  exerciseId: string,
) {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    return {
      ...session,
      exercises: session.exercises.filter((exercise) => exercise.id !== exerciseId),
    };
  });
}

function moveExerciseWithinSession(
  sessions: ProgramSessionDraft[],
  sessionId: string,
  exerciseId: string,
  direction: "up" | "down",
) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) return sessions;

  const currentIndex = session.exercises.findIndex((exercise) => exercise.id === exerciseId);
  if (currentIndex < 0) return sessions;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const targetExerciseId = session.exercises[targetIndex]?.id;
  if (!targetExerciseId) return sessions;

  return reorderExercises(sessions, sessionId, exerciseId, targetExerciseId);
}

function roundToNearest2p5(value: number) {
  return Math.round(value / 2.5) * 2.5;
}

function roundToNearest0p5(value: number) {
  return Math.round(value * 2) / 2;
}

function parsePositiveNumber(input: string) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function formatKg(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalizeExerciseLookupKey(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function targetRecommendationNames(target: OneRmTarget) {
  const fromLabel = normalizeExerciseLookupKey(target.label);
  const fromKey = normalizeExerciseLookupKey(target.key.replace(/^EX_/, "").replace(/_/g, " "));
  const key = String(target.key).trim().toUpperCase();

  const candidates = new Set<string>([fromLabel, fromKey].filter(Boolean));

  if (key.startsWith("EX_")) {
    return Array.from(candidates).map(normalizeExerciseLookupKey).filter(Boolean);
  }

  if (key === "SQUAT") {
    ["back squat", "squat", "스쿼트"].forEach((name) => candidates.add(name));
  } else if (key === "BENCH") {
    ["bench press", "bench", "벤치프레스", "벤치"].forEach((name) => candidates.add(name));
  } else if (key === "DEADLIFT") {
    ["deadlift", "데드리프트"].forEach((name) => candidates.add(name));
  } else if (key === "OHP") {
    ["overhead press", "ohp", "press", "military press", "shoulder press", "밀리터리 프레스"].forEach((name) =>
      candidates.add(name),
    );
  } else if (key === "PULL") {
    ["barbell row", "row", "pull-up", "pull up", "lat pulldown", "pulldown", "풀업", "로우"].forEach((name) =>
      candidates.add(name),
    );
  }

  return Array.from(candidates).map(normalizeExerciseLookupKey).filter(Boolean);
}

function scoreNameMatch(targetName: string, exerciseName: string) {
  if (!targetName || !exerciseName) return 0;
  if (exerciseName === targetName) return 100;
  if (exerciseName.startsWith(targetName) || exerciseName.endsWith(targetName)) return 90;
  if (exerciseName.includes(targetName)) return 75;
  if (targetName.includes(exerciseName)) return 65;
  return 0;
}

function buildOneRmRecommendations(targets: OneRmTarget[], statsItems: PrStatsResponse["items"]): Record<string, OneRmRecommendation> {
  const items = Array.isArray(statsItems) ? statsItems : [];
  const out: Record<string, OneRmRecommendation> = {};

  for (const target of targets) {
    const candidates = targetRecommendationNames(target);
    let bestCandidate:
      | {
          score: number;
          latestDateMs: number;
          latestE1rm: number;
          item: NonNullable<PrStatsResponse["items"]>[number];
        }
      | null = null;

    for (const item of items) {
      const name = normalizeExerciseLookupKey(item.exerciseName ?? "");
      if (!name) continue;

      let nameScore = 0;
      for (const candidate of candidates) {
        nameScore = Math.max(nameScore, scoreNameMatch(candidate, name));
      }
      if (nameScore <= 0) continue;

      const latestE1rm = Number(item.latest?.e1rm ?? item.best?.e1rm ?? 0);
      if (!Number.isFinite(latestE1rm) || latestE1rm <= 0) continue;
      const latestDateRaw = String(item.latest?.date ?? item.best?.date ?? "");
      const latestDateMs = Number.isFinite(Date.parse(latestDateRaw)) ? Date.parse(latestDateRaw) : 0;

      const current = {
        score: nameScore,
        latestDateMs,
        latestE1rm,
        item,
      };
      if (
        !bestCandidate ||
        current.score > bestCandidate.score ||
        (current.score === bestCandidate.score && current.latestDateMs > bestCandidate.latestDateMs) ||
        (current.score === bestCandidate.score &&
          current.latestDateMs === bestCandidate.latestDateMs &&
          current.latestE1rm > bestCandidate.latestE1rm)
      ) {
        bestCandidate = current;
      }
    }

    if (!bestCandidate) continue;

    const latestE1rmKg = Number(bestCandidate.item.latest?.e1rm ?? bestCandidate.item.best?.e1rm ?? 0);
    const bestE1rmKg = Number(bestCandidate.item.best?.e1rm ?? latestE1rmKg);
    if (!Number.isFinite(latestE1rmKg) || latestE1rmKg <= 0) continue;
    if (!Number.isFinite(bestE1rmKg) || bestE1rmKg <= 0) continue;

    out[target.key] = {
      sourceExerciseName: String(bestCandidate.item.exerciseName ?? target.label),
      latestE1rmKg: Math.round(latestE1rmKg * 10) / 10,
      bestE1rmKg: Math.round(bestE1rmKg * 10) / 10,
      recommendedKg: Math.max(1, roundToNearest0p5(latestE1rmKg)),
      latestDate: String(bestCandidate.item.latest?.date ?? bestCandidate.item.best?.date ?? ""),
    };
  }

  return out;
}

function readOneRmFromPlanParams(params: any, key: string, tmPercent: number, fallbackKey?: string | null) {
  const lookupKeys = [key, fallbackKey].filter((value): value is string => Boolean(String(value ?? "").trim()));

  for (const lookupKey of lookupKeys) {
    const oneRmRaw = Number(params?.oneRepMaxKg?.[lookupKey]);
    if (Number.isFinite(oneRmRaw) && oneRmRaw > 0) return oneRmRaw;
  }

  if (tmPercent > 0) {
    for (const lookupKey of lookupKeys) {
      const tmRaw = Number(params?.trainingMaxKg?.[lookupKey]);
      if (Number.isFinite(tmRaw) && tmRaw > 0) {
        return Math.round((tmRaw / tmPercent) * 100) / 100;
      }
    }
  }
  return null;
}

function defaultStartPlanParamsFromTemplate(template: ProgramTemplate) {
  const params: Record<string, unknown> = {};
  const definition = template.latestVersion?.definition as
    | {
        kind?: unknown;
        sessions?: Array<{ key?: unknown }>;
        schedule?: { sessionsPerWeek?: unknown };
      }
    | undefined;
  const scheduleDef = definition?.schedule;
  const sessionsPerWeek = Number(scheduleDef?.sessionsPerWeek);
  if (Number.isFinite(sessionsPerWeek) && sessionsPerWeek > 0) {
    params.sessionsPerWeek = Math.max(1, Math.floor(sessionsPerWeek));
  }
  if (String(template.slug).trim().toLowerCase() === "operator") {
    params.schedule = ["D1", "D2", "D3"];
  } else if (String(definition?.kind ?? "").trim().toLowerCase() === "manual") {
    const manualKeys = (Array.isArray(definition?.sessions) ? definition.sessions : [])
      .map((session) => String(session?.key ?? "").trim())
      .filter(Boolean);
    if (manualKeys.length > 0) {
      params.schedule = manualKeys;
      params.sessionsPerWeek = manualKeys.length;
    }
  }
  return params;
}

function operatorSessionMeta(sessionKey: string) {
  const key = String(sessionKey ?? "").trim().toUpperCase();
  if (key === "D1") return { title: "D1", description: "Squat + Bench + Pull-Up" };
  if (key === "D2") return { title: "D2", description: "Squat + Bench + Pull-Up" };
  if (key === "D3") return { title: "D3", description: "Squat + Bench + Deadlift" };
  return { title: sessionKey, description: "" };
}

function resolveStartTmPercent(template: ProgramTemplate) {
  const tmPercentRaw = Number(template.latestVersion?.defaults?.tmPercent);
  if (isOperatorTemplate(template)) {
    if (!Number.isFinite(tmPercentRaw) || tmPercentRaw <= 0 || tmPercentRaw >= 1) return 0.9;
  }
  return Number.isFinite(tmPercentRaw) && tmPercentRaw > 0 ? tmPercentRaw : 1;
}

async function putProgramVersionDefinition(versionId: string, definition: any) {
  await apiPut(`/api/program-versions/${encodeURIComponent(versionId)}`, { definition });
}

function replaceAbortController(ref: { current: AbortController | null }) {
  ref.current?.abort();
  const controller = new AbortController();
  ref.current = controller;
  return controller;
}

export default function ProgramStorePage() {
  const router = useRouter();
  const { confirm } = useAppDialog();

  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exerciseOptionsLoading, setExerciseOptionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storeLoadKey, setStoreLoadKey] = useState("program-store:init");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);
  const [startProgramDraft, setStartProgramDraft] = useState<StartProgramDraft | null>(null);
  const [customizeDraft, setCustomizeDraft] = useState<CustomizeDraft | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [dragContext, setDragContext] = useState<DragContext | null>(null);
  const [queryState, setQueryState] = useState(() => readSearchQueryFromLocation());
  const customizeExerciseRefs = useRef(new Map<string, HTMLDivElement>());
  const storeLoadControllerRef = useRef<AbortController | null>(null);
  const exerciseOptionsControllerRef = useRef<AbortController | null>(null);
  const oneRmRecommendationControllerRef = useRef<AbortController | null>(null);
  const [pendingCustomizeScrollId, setPendingCustomizeScrollId] = useState<string | null>(null);
  const [recentlyAddedCustomizeExerciseId, setRecentlyAddedCustomizeExerciseId] = useState<string | null>(null);

  const listItems = useMemo(() => toProgramListItems(templates), [templates]);
  const publicTemplates = useMemo(
    () => templates.filter((template) => template.visibility === "PUBLIC"),
    [templates],
  );
  const manualPublicTemplate = useMemo(
    () => publicTemplates.find((template) => template.type === "MANUAL") ?? null,
    [publicTemplates],
  );

  const detailTarget = useMemo(
    () => listItems.find((entry) => entry.template.id === detailTargetId) ?? null,
    [detailTargetId, listItems],
  );
  const customProgramCount = useMemo(
    () => listItems.filter((entry) => entry.source === "CUSTOM").length,
    [listItems],
  );
  const isOperatorCustomization = useMemo(
    () => isOperatorTemplate(customizeDraft?.baseTemplate),
    [customizeDraft],
  );

  const loadOneRmRecommendations = useCallback(async (templateId: string, targets: OneRmTarget[]) => {
    const controller = replaceAbortController(oneRmRecommendationControllerRef);
    try {
      const response = await apiGet<PrStatsResponse>("/api/stats/prs?days=3650&limit=100", {
        signal: controller.signal,
      });
      if (oneRmRecommendationControllerRef.current !== controller) return;
      const recommendations = buildOneRmRecommendations(targets, response.items);

      setStartProgramDraft((prev) => {
        if (!prev || prev.template.id !== templateId) return prev;
        const hasAnyRecommendation = Object.keys(recommendations).length > 0;
        return {
          ...prev,
          recommendations,
          recommendationStatus: "ready",
          recommendationMessage: hasAnyRecommendation
            ? "추천값을 찾았습니다. 필요하면 종목별 '추천값 적용'을 누르세요."
            : "추천 가능한 1RM 통계가 없습니다.",
        };
      });
    } catch (e: any) {
      if (isAbortError(e) || oneRmRecommendationControllerRef.current !== controller) return;
      setStartProgramDraft((prev) => {
        if (!prev || prev.template.id !== templateId) return prev;
        return {
          ...prev,
          recommendationStatus: "failed",
          recommendationMessage: e?.message ?? "1RM 통계 추천값 조회에 실패했습니다.",
        };
      });
    } finally {
      if (oneRmRecommendationControllerRef.current === controller) {
        oneRmRecommendationControllerRef.current = null;
      }
    }
  }, []);

  const loadStore = useCallback(async () => {
    const controller = replaceAbortController(storeLoadControllerRef);
    try {
      setLoading(true);
      setError(null);
      setStoreLoadKey(`program-store:${Date.now()}`);
      const [templatesRes, plansRes] = await Promise.all([
        apiGet<TemplatesResponse>("/api/templates?limit=200", { signal: controller.signal }),
        apiGet<PlansResponse>("/api/plans", { signal: controller.signal }),
      ]);
      if (storeLoadControllerRef.current !== controller) return;
      setTemplates(templatesRes.items ?? []);
      setPlans(plansRes.items ?? []);
    } catch (e: any) {
      if (isAbortError(e) || storeLoadControllerRef.current !== controller) return;
      setError(e?.message ?? "프로그램 데이터를 불러오지 못했습니다.");
    } finally {
      if (storeLoadControllerRef.current === controller) {
        storeLoadControllerRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  const loadExerciseOptions = useCallback(async () => {
    const controller = replaceAbortController(exerciseOptionsControllerRef);
    try {
      setExerciseOptionsLoading(true);
      const res = await apiGet<ExerciseResponse>("/api/exercises?limit=250", {
        signal: controller.signal,
      });
      if (exerciseOptionsControllerRef.current !== controller) return;
      setExerciseOptions(res.items ?? []);
    } catch (error) {
      if (isAbortError(error) || exerciseOptionsControllerRef.current !== controller) return;
      setExerciseOptions([]);
    } finally {
      if (exerciseOptionsControllerRef.current === controller) {
        exerciseOptionsControllerRef.current = null;
        setExerciseOptionsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    void loadExerciseOptions();
  }, [loadExerciseOptions]);

  useEffect(() => {
    if (startProgramDraft) return;
    oneRmRecommendationControllerRef.current?.abort();
    oneRmRecommendationControllerRef.current = null;
  }, [startProgramDraft]);

  useEffect(() => {
    return () => {
      storeLoadControllerRef.current?.abort();
      exerciseOptionsControllerRef.current?.abort();
      oneRmRecommendationControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setQueryState(readSearchQueryFromLocation());
    const onPopState = () => {
      setQueryState(readSearchQueryFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!pendingCustomizeScrollId) return;
    const node = customizeExerciseRefs.current.get(pendingCustomizeScrollId);
    if (!node) return;
    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      setRecentlyAddedCustomizeExerciseId(pendingCustomizeScrollId);
      setPendingCustomizeScrollId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingCustomizeScrollId, customizeDraft]);

  useEffect(() => {
    if (!recentlyAddedCustomizeExerciseId) return;
    const timeout = window.setTimeout(() => {
      setRecentlyAddedCustomizeExerciseId((current) =>
        current === recentlyAddedCustomizeExerciseId ? null : current,
      );
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [recentlyAddedCustomizeExerciseId]);

  useEffect(() => {
    const detailSlug = parseSearchValue(queryState.detail);
    const customizeSlug = parseSearchValue(queryState.customize);
    const createFlag = parseSearchValue(queryState.create);

    if (detailSlug) {
      const item = listItems.find((entry) => entry.template.slug === detailSlug);
      if (item) setDetailTargetId(item.template.id);
    }
    if (customizeSlug) {
      const item = listItems.find((entry) => entry.template.slug === customizeSlug);
      if (item) {
        setCustomizeDraft({
          name: `${formatProgramDisplayName(item.template.name)} Custom`,
          baseTemplate: item.template,
          sessions: inferSessionDraftsFromTemplate(item.template),
        });
      }
    }
    if (createFlag === "1" && templates.length > 0) {
      setCreateDraft(buildInitialCreateDraft(templates));
    }
  }, [listItems, queryState.create, queryState.customize, queryState.detail, templates]);

  const openStartProgramDraft = useCallback(
    (template: ProgramTemplate) => {
      if (!template.latestVersion) {
        setError("선택한 프로그램의 버전 정보가 없습니다.");
        return;
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const today = todayKeyInTimezone(timezone);
      const expectedType = template.type === "MANUAL" ? "MANUAL" : "SINGLE";
      const existing = plans.find(
        (plan) => plan.rootProgramVersionId === template.latestVersion?.id && plan.type === expectedType,
      );
      const tmPercent = resolveStartTmPercent(template);
      const targets = extractOneRmTargetsFromTemplate(template);
      const oneRmInputs: Record<string, string> = {};
      for (const target of targets) {
        const preset = existing ? readOneRmFromPlanParams(existing.params, target.key, tmPercent, target.fallbackKey) : null;
        oneRmInputs[target.key] = preset !== null ? String(preset) : "";
      }

      setStartProgramDraft({
        template,
        expectedPlanType: expectedType,
        existingPlanId: existing?.id ?? null,
        timezone,
        today,
        tmPercent,
        targets,
        oneRmInputs,
        recommendations: {},
        recommendationStatus: "loading",
        recommendationMessage: null,
      });
      setError(null);

      void loadOneRmRecommendations(template.id, targets);
    },
    [loadOneRmRecommendations, plans],
  );

  const submitStartProgram = useCallback(async () => {
    if (!startProgramDraft) return;

    const oneRepMaxKg: Record<string, number> = {};
    const trainingMaxKg: Record<string, number> = {};
    for (const target of startProgramDraft.targets) {
      const parsed = parsePositiveNumber(startProgramDraft.oneRmInputs[target.key] ?? "");
      if (parsed === null) {
        setError(`${target.label} 1RM을 kg 기준으로 입력하세요.`);
        return;
      }
      oneRepMaxKg[target.key] = parsed;
      trainingMaxKg[target.key] = roundToNearest2p5(parsed * startProgramDraft.tmPercent);
      const fallbackKey = String(target.fallbackKey ?? "").trim().toUpperCase();
      if (fallbackKey && oneRepMaxKg[fallbackKey] === undefined) {
        oneRepMaxKg[fallbackKey] = parsed;
        trainingMaxKg[fallbackKey] = trainingMaxKg[target.key]!;
      }
    }

    try {
      setSaving(true);
      setNotice(null);
      const existing = startProgramDraft.existingPlanId
        ? plans.find((plan) => plan.id === startProgramDraft.existingPlanId) ?? null
        : null;

      let targetPlanId = startProgramDraft.existingPlanId;
      const defaultPlanParams = defaultStartPlanParamsFromTemplate(startProgramDraft.template);
      if (existing && targetPlanId) {
        await apiPatch<{ plan: PlanItem }>(`/api/plans/${encodeURIComponent(targetPlanId)}`, {
          params: {
            ...(existing.params ?? {}),
            ...defaultPlanParams,
            startDate: startProgramDraft.today,
            timezone: startProgramDraft.timezone,
            sessionKeyMode: "DATE",
            oneRepMaxKg,
            trainingMaxKg,
          },
        });
      } else {
        const created = await apiPost<{ plan: PlanItem }>("/api/plans", {
          name: `${formatProgramDisplayName(startProgramDraft.template.name)} Program`,
          type: startProgramDraft.expectedPlanType,
          rootProgramVersionId: startProgramDraft.template.latestVersion!.id,
          params: {
            ...defaultPlanParams,
            startDate: startProgramDraft.today,
            timezone: startProgramDraft.timezone,
            sessionKeyMode: "DATE",
            oneRepMaxKg,
            trainingMaxKg,
          },
        });
        targetPlanId = created.plan.id;
      }

      if (!targetPlanId) {
        throw new Error("플랜 생성/갱신 결과가 올바르지 않습니다.");
      }

      await loadStore();
      setStartProgramDraft(null);
      router.push(
        `/workout-record?planId=${encodeURIComponent(targetPlanId)}&date=${startProgramDraft.today}&context=today`,
      );
    } catch (e: any) {
      setError(e?.message ?? "프로그램 시작에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [loadStore, plans, router, startProgramDraft]);

  const deleteCustomTemplate = useCallback(
    async (item: ProgramListItem) => {
      if (item.source !== "CUSTOM") return;
      const confirmed = await confirm({
        title: "커스텀 프로그램 삭제",
        message: `커스텀 프로그램 "${item.template.name}"을(를) 삭제할까요?\n연결된 내 플랜도 함께 삭제됩니다.`,
        confirmText: "삭제",
        cancelText: "취소",
        tone: "danger",
      });
      if (!confirmed) return;

      try {
        setSaving(true);
        setError(null);
        setNotice(null);
        const res = await apiDelete<DeleteTemplateResponse>(
          `/api/templates/${encodeURIComponent(item.template.slug)}`,
        );
        const deletedPlanSuffix =
          Number(res.deletedPlanCount) > 0
            ? ` (연결 플랜 ${res.deletedPlanCount}개 삭제)`
            : "";

        setDetailTargetId(null);
        setCustomizeDraft(null);
        setStartProgramDraft(null);
        await loadStore();
        setNotice(`커스텀 프로그램 삭제 완료: ${formatProgramDisplayName(item.template.name)}${deletedPlanSuffix}`);
      } catch (e: any) {
        setError(e?.message ?? "커스텀 프로그램 삭제에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [confirm, loadStore],
  );

  const saveCustomizationDraft = useCallback(
    async (draft: CustomizeDraft) => {
      const errors = validateCustomSessions(draft.sessions);
      if (!draft.name.trim()) {
        errors.push("커스터마이징 프로그램 이름을 입력하세요.");
      }
      if (errors.length > 0) {
        setError(errors[0]);
        return;
      }

      try {
        setSaving(true);
        setError(null);
        const forkSourceTemplate =
          draft.baseTemplate.type === "MANUAL" ? draft.baseTemplate : manualPublicTemplate;
        if (!forkSourceTemplate) {
          throw new Error("세션 커스터마이징용 Manual 템플릿을 찾지 못했습니다.");
        }

        const fork = await apiPost<ForkResponse>(`/api/templates/${encodeURIComponent(forkSourceTemplate.slug)}/fork`, {
          newName: draft.name.trim(),
          newSlug: makeForkSlug(draft.name),
        });

        const definition = toManualDefinition(draft.sessions, {
          operatorStyle: isOperatorTemplate(draft.baseTemplate),
          programFamily: isOperatorTemplate(draft.baseTemplate) ? "operator" : null,
        });
        await putProgramVersionDefinition(fork.version.id, definition);

        setNotice(`커스터마이징 프로그램 생성 완료: ${formatProgramDisplayName(fork.template.name)}`);
        setCustomizeDraft(null);
        setDetailTargetId(null);
        await loadStore();
      } catch (e: any) {
        setError(e?.message ?? "커스터마이징 저장에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [loadStore, manualPublicTemplate],
  );

  const saveCreateDraft = useCallback(
    async (draft: CreateDraft) => {
      const errors = validateCustomSessions(draft.sessions);
      if (!draft.name.trim()) {
        errors.push("프로그램 이름을 입력하세요.");
      }

      let sourceSlug: string | null = null;
      if (draft.mode === "MARKET_BASED") {
        sourceSlug = draft.sourceTemplateSlug;
      } else {
        sourceSlug = manualPublicTemplate?.slug ?? null;
      }
      if (!sourceSlug) {
        errors.push("기반 프로그램을 찾지 못했습니다.");
      }
      if (errors.length > 0) {
        setError(errors[0]);
        return;
      }

      try {
        setSaving(true);
        setError(null);
        const fork = await apiPost<ForkResponse>(`/api/templates/${encodeURIComponent(sourceSlug!)}/fork`, {
          newName: draft.name.trim(),
          newSlug: makeForkSlug(draft.name),
        });

        const definition = toManualDefinition(draft.sessions);
        await putProgramVersionDefinition(fork.version.id, definition);

        setNotice(`커스텀 프로그램 생성 완료: ${formatProgramDisplayName(fork.template.name)}`);
        setCreateDraft(null);
        await loadStore();
      } catch (e: any) {
        setError(e?.message ?? "커스텀 프로그램 생성에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [loadStore, manualPublicTemplate?.slug],
  );

  const applyDragReorder = useCallback(
    (targetSessionId: string, targetExerciseId: string) => {
      if (!dragContext) return;
      setCustomizeDraft((prev) => {
        if (!prev) return prev;
        const withinSame = dragContext.sourceSessionId === targetSessionId;
        const nextSessions = withinSame
          ? reorderExercises(prev.sessions, targetSessionId, dragContext.sourceExerciseId, targetExerciseId)
          : moveExerciseBetweenSessions(prev.sessions, dragContext.sourceSessionId, dragContext.sourceExerciseId, targetSessionId, 0);

        return {
          ...prev,
          sessions: nextSessions,
        };
      });
      setCreateDraft((prev) => {
        if (!prev) return prev;
        const withinSame = dragContext.sourceSessionId === targetSessionId;
        const nextSessions = withinSame
          ? reorderExercises(prev.sessions, targetSessionId, dragContext.sourceExerciseId, targetExerciseId)
          : moveExerciseBetweenSessions(prev.sessions, dragContext.sourceSessionId, dragContext.sourceExerciseId, targetSessionId, 0);
        return {
          ...prev,
          sessions: nextSessions,
        };
      });
      setDragContext(null);
    },
    [dragContext],
  );

  const patchCustomizeExercise = useCallback(
    (sessionId: string, exerciseId: string, patch: Partial<ProgramExerciseDraft>) => {
      setCustomizeDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sessions: patchExerciseInSessions(prev.sessions, sessionId, exerciseId, patch),
        };
      });
    },
    [],
  );

  const moveCustomizeExercise = useCallback(
    (sessionId: string, exerciseId: string, direction: "up" | "down") => {
      setCustomizeDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sessions: moveExerciseWithinSession(prev.sessions, sessionId, exerciseId, direction),
        };
      });
    },
    [],
  );

  const deleteCustomizeExercise = useCallback((sessionId: string, exerciseId: string) => {
    setCustomizeDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: deleteExerciseFromSessions(prev.sessions, sessionId, exerciseId),
      };
    });
  }, []);

  const patchCreateExercise = useCallback(
    (sessionId: string, exerciseId: string, patch: Partial<ProgramExerciseDraft>) => {
      setCreateDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sessions: patchExerciseInSessions(prev.sessions, sessionId, exerciseId, patch),
        };
      });
    },
    [],
  );

  const moveCreateExercise = useCallback(
    (sessionId: string, exerciseId: string, direction: "up" | "down") => {
      setCreateDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sessions: moveExerciseWithinSession(prev.sessions, sessionId, exerciseId, direction),
        };
      });
    },
    [],
  );

  const deleteCreateExercise = useCallback((sessionId: string, exerciseId: string) => {
    setCreateDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: deleteExerciseFromSessions(prev.sessions, sessionId, exerciseId),
      };
    });
  }, []);

  const startExerciseDrag = useCallback((sessionId: string, exerciseId: string) => {
    setDragContext({
      sourceSessionId: sessionId,
      sourceExerciseId: exerciseId,
    });
  }, []);

  const dropExerciseOnTarget = useCallback(
    (sessionId: string, exerciseId: string) => {
      applyDragReorder(sessionId, exerciseId);
    },
    [applyDragReorder],
  );

  const openCreateSheet = () => {
    setError(null);
    setCreateDraft(buildInitialCreateDraft(templates));
  };

  const isStoreSettled = useQuerySettled(storeLoadKey, loading);

  return (
    <div className="native-page native-page-enter tab-screen app-dashboard-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={160}
        label="프로그램 불러오는 중"
      />
      <ErrorStateRows
        message={error}
        title="프로그램 화면을 불러오지 못했습니다"
        onRetry={() => {
          void loadStore();
        }}
      />
      <NoticeStateRows message={notice} label="프로그램 안내" />

      <DashboardSection
        title="프로그램 목록"
        description="시중 프로그램과 커스텀 프로그램을 같은 카드 톤으로 묶어 탐색 흐름을 단순화했습니다."
      >
        <EmptyStateRows
          when={isStoreSettled && !error && listItems.length === 0}
          label="표시할 프로그램이 없습니다"
        />
        {listItems.length > 0 && (
          <DashboardSurface className="grid gap-2">
            {listItems.map((item) => {
              const badge = sourceBadgeMeta(item.source);
              return (
                <button
                  key={item.key}
                  type="button"
                  className="haptic-tap rounded-xl border p-3 grid gap-1 text-left"
                  onClick={() => {
                    setDetailTargetId(item.template.id);
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong>{formatProgramDisplayName(item.name)}</strong>
                    <span className={`ui-badge ${badge.className}`}>{badge.label}</span>
                  </span>
                </button>
              );
            })}
          </DashboardSurface>
        )}
      </DashboardSection>

      <DashboardSection
        title="커스터마이징 시작"
        description="새 프로그램 생성 진입점도 동일한 서피스 안에서 유지합니다."
      >
        <DashboardSurface>
          <button
            type="button"
            className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold text-left"
            onClick={openCreateSheet}
          >
            프로그램 커스터마이징 모달 열기
          </button>
        </DashboardSurface>
      </DashboardSection>

      <BottomSheet
        open={Boolean(detailTarget)}
        title="프로그램 상세"
        description={detailTarget ? toContextLabel(detailTarget) : ""}
        onClose={() => setDetailTargetId(null)}
        closeLabel="닫기"
        className="program-store-sheet program-store-sheet--medium"
        footer={
          detailTarget ? (
            <div className="grid gap-2">
              <button
                type="button"
                className="ui-primary-button"
                disabled={saving || !detailTarget.template.latestVersion}
                onClick={() => {
                  openStartProgramDraft(detailTarget.template);
                }}
              >
                프로그램 선택하여 시작하기
              </button>
              <button
                type="button"
                className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold"
                onClick={() => {
                  setCustomizeDraft({
                    name: `${formatProgramDisplayName(detailTarget.template.name)} Custom`,
                    baseTemplate: detailTarget.template,
                    sessions: inferSessionDraftsFromTemplate(detailTarget.template),
                  });
                }}
              >
                프로그램 커스터마이징
              </button>
              {detailTarget.source === "CUSTOM" ? (
                <button
                  type="button"
                  className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold text-red-600"
                  disabled={saving}
                  onClick={() => {
                    void deleteCustomTemplate(detailTarget);
                  }}
                >
                  커스텀 프로그램 삭제
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {detailTarget && (
          <div className="grid gap-2">
            <Card padding="sm" elevated={false}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{formatProgramDisplayName(detailTarget.template.name)}</CardTitle>
                {(() => {
                  const badge = sourceBadgeMeta(detailTarget.source);
                  return <span className={`ui-badge ${badge.className}`}>{badge.label}</span>;
                })()}
              </div>
              <CardDescription className="mt-1">
                타입: {detailTarget.template.type} / 최신 버전:{" "}
                {detailTarget.template.latestVersion ? `v${detailTarget.template.latestVersion.version}` : "-"}
              </CardDescription>
            </Card>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(startProgramDraft)}
        title="시작 전 1RM 입력"
        description="모든 종목의 1RM 입력이 필수입니다."
        onClose={() => setStartProgramDraft(null)}
        closeLabel="닫기"
        className="program-store-sheet program-store-sheet--medium"
        footer={
          startProgramDraft ? (
            <div className="grid gap-2">
              <button
                type="button"
                className="ui-primary-button"
                disabled={saving}
                onClick={() => {
                  void submitStartProgram();
                }}
              >
                1RM 저장 후 시작
              </button>
            </div>
          ) : null
        }
      >
        {startProgramDraft ? (
          <div className="grid gap-3">
            <Card padding="sm" elevated={false}>
              <CardHeader>
                <CardTitle>{formatProgramDisplayName(startProgramDraft.template.name)}</CardTitle>
                <div className="ui-card-label">
                TM 계산 비율: {Math.round(startProgramDraft.tmPercent * 100)}%
                </div>
              </CardHeader>
            </Card>
            {startProgramDraft.recommendationStatus === "loading" ? (
              <p className="ui-card-label">운동 종목별 1RM 통계 기반 추천값 계산 중...</p>
            ) : null}
            {startProgramDraft.recommendationMessage ? (
              <p className="ui-card-label">{startProgramDraft.recommendationMessage}</p>
            ) : null}
            {startProgramDraft.targets.map((target) => (
              <label key={target.key} className="grid gap-2">
                <span className="ui-card-label">
                  {target.label} 1RM (kg)
                </span>
                <AppTextInput
                  variant="workout-number"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.5"
                  value={startProgramDraft.oneRmInputs[target.key] ?? ""}
                  onChange={(event) =>
                    setStartProgramDraft((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        oneRmInputs: {
                          ...prev.oneRmInputs,
                          [target.key]: event.target.value,
                        },
                      };
                    })
                  }
                />
                {startProgramDraft.recommendations[target.key] ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="ui-card-label">
                      추천 {formatKg(startProgramDraft.recommendations[target.key].recommendedKg)}kg
                      {" · "}
                      최근 e1RM {formatKg(startProgramDraft.recommendations[target.key].latestE1rmKg)}kg
                    </span>
                    <button
                      type="button"
                      className="haptic-tap rounded-lg border px-2 py-1 text-xs font-semibold"
                      onClick={() =>
                        setStartProgramDraft((prev) => {
                          if (!prev) return prev;
                          const recommendation = prev.recommendations[target.key];
                          if (!recommendation) return prev;
                          return {
                            ...prev,
                            oneRmInputs: {
                              ...prev.oneRmInputs,
                              [target.key]: String(recommendation.recommendedKg),
                            },
                          };
                        })
                      }
                    >
                      추천값 적용
                    </button>
                  </div>
                ) : null}
              </label>
            ))}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(customizeDraft)}
        title={isOperatorCustomization ? "Operator 커스터마이징" : "커스터마이징 모달"}
        description={
          customizeDraft
            ? isOperatorCustomization
              ? `기본 3일 구성 편집 · ${customizeDraft.baseTemplate.name}`
              : `컨텍스트: ${customizeDraft.baseTemplate.name}`
            : ""
        }
        onClose={() => setCustomizeDraft(null)}
        closeLabel="닫기"
        className="program-store-sheet program-store-sheet--large"
        footer={
          customizeDraft ? (
            <div className="grid gap-2">
              <button
                type="button"
                className="ui-primary-button"
                disabled={saving}
                onClick={() => {
                  void saveCustomizationDraft(customizeDraft);
                }}
              >
                커스터마이징 프로그램 저장
              </button>
            </div>
          ) : null
        }
      >
        {customizeDraft && (
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="ui-card-label">프로그램 이름</span>
              <AppTextInput
                variant="workout"
                value={customizeDraft.name}
                onChange={(event) =>
                  setCustomizeDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>

            {isOperatorCustomization ? (
              <Card tone="subtle" padding="sm" elevated={false} className="text-sm text-neutral-700">
                <CardHeader>
                  <CardTitle>Operator 기본 구성</CardTitle>
                  <CardDescription>D1/D2는 `Squat + Bench + Pull-Up`, D3는 `Squat + Bench + Deadlift` 기준으로 시작합니다.</CardDescription>
                  <CardDescription>세션 순서는 고정하고, 각 day의 종목만 교체/추가/삭제할 수 있게 정리했습니다.</CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            <Card padding="sm" elevated={false}>
              <CardHeader>
                <CardTitle>{isOperatorCustomization ? "Day별 종목 변경" : "세션별 종목 변경 (수정/삭제/추가)"}</CardTitle>
              </CardHeader>
              <CardContent>
              {customizeDraft.sessions.map((session) => {
                const meta = operatorSessionMeta(session.key);
                const summary = session.exercises
                  .map((exercise) => exercise.exerciseName.trim())
                  .filter(Boolean)
                  .join(" + ");

                return (
                <div
                  key={session.id}
                  className="program-store-session-card"
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!dragContext) return;
                    setCustomizeDraft((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        sessions: moveExerciseBetweenSessions(
                          prev.sessions,
                          dragContext.sourceSessionId,
                          dragContext.sourceExerciseId,
                          session.id,
                          session.exercises.length,
                        ),
                      };
                    });
                    setDragContext(null);
                  }}
                >
                  <header className="program-store-session-head">
                    <div className="grid gap-0.5">
                      <strong>{isOperatorCustomization ? meta.title : `세션 ${session.key}`}</strong>
                      {isOperatorCustomization ? (
                        <span className="text-xs text-[var(--text-secondary)]">
                          {summary || meta.description}
                        </span>
                      ) : null}
                    </div>
                  </header>

                  {session.exercises.length === 0 && (
                    <div className="rounded-lg border p-3 text-sm text-[var(--text-secondary)]">운동이 없습니다.</div>
                  )}

                  {session.exercises.map((exercise, exerciseIndex) => (
                    <div
                      key={exercise.id}
                      ref={(node) => {
                        if (node) {
                          customizeExerciseRefs.current.set(exercise.id, node);
                        } else {
                          customizeExerciseRefs.current.delete(exercise.id);
                        }
                      }}
                    >
                      <ExerciseEditorRow
                        exercise={exercise}
                        sessionId={session.id}
                        publicTemplates={publicTemplates}
                        exerciseOptions={exerciseOptions}
                        exerciseOptionsLoading={exerciseOptionsLoading}
                        operatorStyle={isOperatorCustomization}
                        highlighted={recentlyAddedCustomizeExerciseId === exercise.id}
                        canMoveUp={exerciseIndex > 0}
                        canMoveDown={exerciseIndex < session.exercises.length - 1}
                        onPatch={patchCustomizeExercise}
                        onMove={moveCustomizeExercise}
                        onDelete={deleteCustomizeExercise}
                        onDragStart={startExerciseDrag}
                        onDrop={dropExerciseOnTarget}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    className="haptic-tap mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]"
                    onClick={() => {
                      const addedExercise = createEmptyExerciseDraft(
                        isOperatorCustomization ? null : customizeDraft.baseTemplate.slug,
                        isOperatorCustomization ? "CUSTOM" : null,
                      );
                      setPendingCustomizeScrollId(addedExercise.id);
                      setCustomizeDraft((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          sessions: prev.sessions.map((entry) => {
                            if (entry.id !== session.id) return entry;
                            return {
                              ...entry,
                              exercises: [...entry.exercises, addedExercise],
                            };
                          }),
                        };
                      });
                    }}
                  >
                    <span className="text-lg leading-none text-[var(--accent-primary)]" aria-hidden="true">
                      +
                    </span>
                    <span>운동 추가</span>
                  </button>
                </div>
              );
            })}
              </CardContent>
            </Card>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(createDraft)}
        title="프로그램 생성/커스터마이징 모달"
        description="새 커스텀 프로그램 생성"
        onClose={() => setCreateDraft(null)}
        closeLabel="닫기"
        className="program-store-sheet program-store-sheet--large"
        footer={
          createDraft ? (
            <div className="grid gap-2">
              <button
                type="button"
                className="ui-primary-button"
                disabled={saving}
                onClick={() => {
                  void saveCreateDraft(createDraft);
                }}
              >
                프로그램 생성
              </button>
            </div>
          ) : null
        }
      >
        {createDraft && (
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="ui-card-label">프로그램 이름</span>
              <AppTextInput
                variant="workout"
                value={createDraft.name}
                onChange={(event) =>
                  setCreateDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
                placeholder="예: My Upper/Lower Custom"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold ${
                  createDraft.mode === "MARKET_BASED" ? "border-[color:var(--accent-primary)]" : ""
                }`}
                onClick={() =>
                  setCreateDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          mode: "MARKET_BASED",
                        }
                      : prev,
                  )
                }
              >
                시중 기반 커스터마이징
              </button>
              <button
                type="button"
                className={`haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold ${
                  createDraft.mode === "FULL_MANUAL" ? "border-[color:var(--accent-primary)]" : ""
                }`}
                onClick={() =>
                  setCreateDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          mode: "FULL_MANUAL",
                        }
                      : prev,
                  )
                }
              >
                완전 수동
              </button>
            </div>

            {createDraft.mode === "MARKET_BASED" && (
              <AppSelect
                label="기반 시중 프로그램"
                value={createDraft.sourceTemplateSlug ?? ""}
                onChange={(event) =>
                  setCreateDraft((prev) => {
                    if (!prev) return prev;
                    const nextSlug = event.target.value || null;
                    const source = templates.find((template) => template.slug === nextSlug) ?? null;
                    return {
                      ...prev,
                      sourceTemplateSlug: nextSlug,
                      sessions: source ? inferSessionDraftsFromTemplate(source) : prev.sessions,
                    };
                  })
                }
              >
                <option value="">선택</option>
                {publicTemplates.map((template) => (
                  <option key={template.id} value={template.slug}>
                    {formatProgramDisplayName(template.name)}
                  </option>
                ))}
              </AppSelect>
            )}

            <Card padding="sm" elevated={false}>
              <CardHeader>
                <CardTitle>세션 규칙 생성</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`haptic-tap rounded-lg border px-3 py-2 text-sm ${
                    createDraft.rule.type === "AB" ? "border-[color:var(--accent-primary)]" : ""
                  }`}
                  onClick={() =>
                    setCreateDraft((prev) => {
                      if (!prev) return prev;
                      const nextRule: SessionRule = { type: "AB", count: 2 };
                      return {
                        ...prev,
                        rule: nextRule,
                        sessions: reconcileSessionsByKeys(prev.sessions, makeSessionKeys(nextRule)),
                      };
                    })
                  }
                >
                  A/B 규칙
                </button>
                <button
                  type="button"
                  className={`haptic-tap rounded-lg border px-3 py-2 text-sm ${
                    createDraft.rule.type === "NUMERIC" ? "border-[color:var(--accent-primary)]" : ""
                  }`}
                  onClick={() =>
                    setCreateDraft((prev) => {
                      if (!prev) return prev;
                      const nextRule: SessionRule = { type: "NUMERIC", count: prev.rule.count || 2 };
                      return {
                        ...prev,
                        rule: nextRule,
                        sessions: reconcileSessionsByKeys(prev.sessions, makeSessionKeys(nextRule)),
                      };
                    })
                  }
                >
                  1~4 세션
                </button>
              </div>
              {createDraft.rule.type === "NUMERIC" && (
                <label className="grid gap-1">
                  <span className="ui-card-label">세션 개수 (1~4)</span>
                  <AppTextInput
                    variant="workout-number"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={4}
                    value={createDraft.rule.count}
                    onChange={(event) =>
                      setCreateDraft((prev) => {
                        if (!prev) return prev;
                        const nextCount = Math.max(1, Math.min(4, Number(event.target.value) || 1));
                        const nextRule: SessionRule = { type: "NUMERIC", count: nextCount };
                        return {
                          ...prev,
                          rule: nextRule,
                          sessions: reconcileSessionsByKeys(prev.sessions, makeSessionKeys(nextRule)),
                        };
                      })
                    }
                  />
                </label>
              )}
              </CardContent>
            </Card>

            <Card padding="sm" elevated={false}>
              <CardHeader>
                <CardTitle>세션 안에 운동종목 배치</CardTitle>
              </CardHeader>
              <CardContent>
              {createDraft.sessions.map((session) => (
                <div
                  key={session.id}
                  className="program-store-session-card"
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!dragContext) return;
                    setCreateDraft((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        sessions: moveExerciseBetweenSessions(
                          prev.sessions,
                          dragContext.sourceSessionId,
                          dragContext.sourceExerciseId,
                          session.id,
                          session.exercises.length,
                        ),
                      };
                    });
                    setDragContext(null);
                  }}
                >
                  <header className="program-store-session-head">
                    <strong>세션 {session.key}</strong>
                  </header>

                  {session.exercises.length === 0 && (
                    <div className="rounded-lg border p-3 text-sm text-[var(--text-secondary)]">운동이 없습니다.</div>
                  )}

                  {session.exercises.map((exercise, exerciseIndex) => (
                    <ExerciseEditorRow
                      key={exercise.id}
                      sessionId={session.id}
                      exercise={exercise}
                      publicTemplates={publicTemplates}
                      exerciseOptions={exerciseOptions}
                      exerciseOptionsLoading={exerciseOptionsLoading}
                      canMoveUp={exerciseIndex > 0}
                      canMoveDown={exerciseIndex < session.exercises.length - 1}
                      onPatch={patchCreateExercise}
                      onMove={moveCreateExercise}
                      onDelete={deleteCreateExercise}
                      onDragStart={startExerciseDrag}
                      onDrop={dropExerciseOnTarget}
                    />
                  ))}

                  <button
                    type="button"
                    className="haptic-tap mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]"
                    onClick={() =>
                      setCreateDraft((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          sessions: prev.sessions.map((entry) => {
                            if (entry.id !== session.id) return entry;
                            return {
                              ...entry,
                              exercises: [
                                ...entry.exercises,
                                createEmptyExerciseDraft(
                                  prev.mode === "MARKET_BASED" ? prev.sourceTemplateSlug : null,
                                ),
                              ],
                            };
                          }),
                        };
                      })
                    }
                  >
                    <span className="text-lg leading-none text-[var(--accent-primary)]" aria-hidden="true">
                      +
                    </span>
                    <span>운동 추가</span>
                  </button>
                </div>
              ))}
              </CardContent>
            </Card>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
