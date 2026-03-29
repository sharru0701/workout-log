"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ExerciseEditorRow from "./_components/program-exercise-editor-row";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { NumberPickerField } from "@/components/ui/number-picker-sheet";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyStateRows, ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, isAbortError } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import {
  createEmptyExerciseDraft,
  extractOneRmTargetsFromTemplate,
  getProgramDetailInfo,
  getProgramScheduleLabel,
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

const MODULE_NAMES: Record<string, string> = {
  SQUAT: "스쿼트",
  BENCH: "벤치프레스",
  DEADLIFT: "데드리프트",
  OHP: "오버헤드 프레스",
  PULL: "풀업 / 로우",
};

const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
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

function formatProgramDisplayName(name: string) {
  return String(name)
    .replace(/\s*\(base[^)]*\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sourceBadgeMeta(source: ProgramListItem["source"]) {
  if (source === "CUSTOM") {
    return { label: "커스텀", className: "label label-tag-custom" };
  }
  return { label: "기본", className: "label label-tag-session" };
}

/**
 * INFO COLOR: tag semantic classification
 * 태그를 정보 속성별로 분류해서 시각적으로 구분.
 * - 세트 방식/강도 기법 (amrap, top-set, rpe) → purple (set-type)
 * - 훈련 목표 (strength, power, hypertrophy) → cyan (program)
 * - 진행 방식 (linear, progression) → blue (exercise)
 * - 나머지 → neutral gray (note)
 */
function tagLabelClass(tag: string): string {
  const t = tag.toLowerCase().trim();
  if (["manual", "fixed", "custom"].some((k) => t.includes(k))) {
    return "label label-tag-manual label-sm";
  }
  if (["beginner", "novice", "starter", "입문", "초보"].some((k) => t.includes(k))) {
    return "label label-tag-beginner label-sm";
  }
  if (["amrap", "top-set", "topset", "top set", "rpe", "rir"].some((k) => t.includes(k))) {
    return t.includes("amrap") ? "label label-tag-amrap label-sm" : "label label-tag-top-set label-sm";
  }
  if (["strength", "power", "hypertrophy", "근력", "파워", "근비대"].some((k) => t.includes(k))) {
    return "label label-tag-session label-sm";
  }
  if (["linear", "progression", "wave", "periodization", "선형", "주기화"].some((k) => t.includes(k))) {
    return "label label-tag-progression label-sm";
  }
  if (["base", "variant", "template", "library", "operator"].some((k) => t.includes(k))) {
    return "label label-tag-identity label-sm";
  }
  return "label label-tag-custom label-sm";
}

function ProgramListCard({
  item,
  onPress,
}: {
  item: ProgramListItem;
  onPress: () => void;
}) {
  const badge = sourceBadgeMeta(item.source);
  const tags = Array.isArray(item.template.tags) ? item.template.tags : [];

  return (
    <Card
      as="button"
      type="button"
      padding="sm"
      tone="inset"
      elevated={false}
      interactive
      onClick={onPress}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
        <div>
          {/* INFO COLOR: plan-name — 프로그램명은 명시적 색상으로 계층 보장 */}
          <strong style={{ font: "var(--font-card-title)", color: "var(--text-plan-name)" }}>
            {formatProgramDisplayName(item.name)}
          </strong>
        </div>
        <span className={`${badge.className} label-sm`}>
          {badge.label}
        </span>
      </div>

      {item.template.description ? (
        <p style={{ font: "var(--font-secondary)", color: "var(--text-meta)", marginBottom: "var(--space-sm)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.template.description}
        </p>
      ) : null}

      {tags.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
          {/* INFO COLOR: tag semantic — 태그 속성별로 색상 분류 */}
          {tags.slice(0, 5).map((tag) => (
            <span key={tag} className={tagLabelClass(tag)}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
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

function normalizeSearchText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
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
  if (key === "D4") return { title: "D4", description: "Overhead Press" };
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
  const [storeQuery, setStoreQuery] = useState("");

  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);
  const [startProgramDraft, setStartProgramDraft] = useState<StartProgramDraft | null>(null);
  const [customizeDraft, setCustomizeDraft] = useState<CustomizeDraft | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [dragContext, setDragContext] = useState<DragContext | null>(null);
  const [queryState, setQueryState] = useState(() => readSearchQueryFromLocation());
  const customizeExerciseRefs = useRef(new Map<string, HTMLDivElement>());
  const storeLoadControllerRef = useRef<AbortController | null>(null);
  const storeHasLoadedRef = useRef(false);
  const exerciseOptionsControllerRef = useRef<AbortController | null>(null);
  const oneRmRecommendationControllerRef = useRef<AbortController | null>(null);
  const [pendingCustomizeScrollId, setPendingCustomizeScrollId] = useState<string | null>(null);
  const [recentlyAddedCustomizeExerciseId, setRecentlyAddedCustomizeExerciseId] = useState<string | null>(null);

  const listItems = useMemo(() => toProgramListItems(templates), [templates]);
  const filteredListItems = useMemo(() => {
    const normalizedQuery = storeQuery.trim().toLowerCase();
    if (!normalizedQuery) return listItems;
    return listItems.filter((item) => {
      const scheduleLabel = getProgramScheduleLabel(item.template);
      const tags = Array.isArray(item.template.tags) ? item.template.tags.join(" ") : "";
      return normalizeSearchText(
        formatProgramDisplayName(item.name),
        item.subtitle,
        item.description,
        scheduleLabel,
        tags,
      ).includes(normalizedQuery);
    });
  }, [listItems, storeQuery]);
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
  const marketListItems = useMemo(
    () => filteredListItems.filter((entry) => entry.source === "MARKET"),
    [filteredListItems],
  );
  const customListItems = useMemo(
    () => filteredListItems.filter((entry) => entry.source === "CUSTOM"),
    [filteredListItems],
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
        const oneRmInputs = { ...prev.oneRmInputs };
        for (const target of prev.targets) {
          const rec = recommendations[target.key];
          if (rec && oneRmInputs[target.key] === "50") {
            oneRmInputs[target.key] = String(rec.recommendedKg);
          }
        }
        return {
          ...prev,
          recommendations,
          oneRmInputs,
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

  const loadStore = useCallback(async (options?: { isRefresh?: boolean }) => {
    const controller = replaceAbortController(storeLoadControllerRef);
    try {
      if (!storeHasLoadedRef.current && !options?.isRefresh) {
        setLoading(true);
      }
      setError(null);
      setStoreLoadKey(`program-store:${Date.now()}`);
      const [templatesRes, plansRes] = await Promise.all([
        apiGet<TemplatesResponse>("/api/templates?limit=200", { signal: controller.signal }),
        apiGet<PlansResponse>("/api/plans", { signal: controller.signal }),
      ]);
      if (storeLoadControllerRef.current !== controller) return;
      storeHasLoadedRef.current = true;
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

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([loadStore({ isRefresh: true }), loadExerciseOptions()]);
    },
  });

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
        oneRmInputs[target.key] = preset !== null ? String(preset) : "50";
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

      void loadStore({ isRefresh: true });
      setStartProgramDraft(null);
      router.push(
        `/workout/log?planId=${encodeURIComponent(targetPlanId)}&date=${startProgramDraft.today}&context=today`,
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

        // Optimistic UI: 삭제 대상 리스트에서 즉시 제거
        setTemplates((prev) => prev.filter((t) => t.id !== item.template.id));

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
        
        // 백그라운드 동기화용 (화면 로딩 없음)
        void loadStore({ isRefresh: true });
        setNotice(`커스텀 프로그램 삭제 완료: ${formatProgramDisplayName(item.template.name)}${deletedPlanSuffix}`);
      } catch (e: any) {
        setError(e?.message ?? "커스텀 프로그램 삭제에 실패했습니다.");
        // 실패 시 데이터 원상복구
        void loadStore({ isRefresh: true });
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

        // Optimistic UI: 새로 생성한 커스텀 템플릿 목록에 즉각 추가
        setTemplates((prev) => [fork.template, ...prev]);

        setNotice(`커스터마이징 프로그램 생성 완료: ${formatProgramDisplayName(fork.template.name)}`);
        setCustomizeDraft(null);
        setDetailTargetId(null);
        
        void loadStore({ isRefresh: true });
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

        // Optimistic UI: 생성된 템플릿 최상단 즉각 반영
        setTemplates((prev) => [fork.template, ...prev]);

        setNotice(`커스텀 프로그램 생성 완료: ${formatProgramDisplayName(fork.template.name)}`);
        setCreateDraft(null);
        void loadStore({ isRefresh: true });
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
  const hasStoreQuery = storeQuery.trim().length > 0;

  return (
    <PullToRefreshShell pullToRefresh={pullToRefresh}>
      {loading && (
        <div style={{ paddingBlock: "var(--space-md)" }}>
          <style>{`
            @keyframes skeleton-shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          <div className="card" style={{ padding: 0, marginBottom: "var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 48, borderRadius: 10 }} />
          </div>

          <section>
            <div style={{ marginBottom: "var(--space-sm)" }}>
              <div style={{ ...skeletonStyle, height: 10, width: "25%", marginBottom: "6px" }} />
              <div style={{ ...skeletonStyle, height: 18, width: "40%" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card" data-card-tone="inset" data-card-elevated="false" style={{ padding: "var(--space-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-xs)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                        <div style={{ ...skeletonStyle, height: 18, width: "60%" }} />
                        <div style={{ ...skeletonStyle, height: 14, width: "20%", borderRadius: 4 }} />
                      </div>
                    </div>
                    <div style={{ ...skeletonStyle, height: 22, width: 44, borderRadius: 12 }} />
                  </div>
                  <div style={{ ...skeletonStyle, height: 14, width: "85%", marginBottom: "var(--space-sm)", borderRadius: 4 }} />
                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} style={{ ...skeletonStyle, height: 22, width: 56, borderRadius: 12 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <ErrorStateRows
        message={error}
        title="프로그램 화면을 불러오지 못했습니다"
        onRetry={() => {
          void loadStore();
        }}
      />
      <NoticeStateRows message={notice} label="프로그램 안내" />

      {listItems.length > 0 || hasStoreQuery ? (
        <SearchInput
          value={storeQuery}
          onChange={setStoreQuery}
          placeholder="프로그램명, 설명, 태그 검색"
          ariaLabel="스토어 검색"
        />
      ) : null}

      <EmptyStateRows
        when={isStoreSettled && !error && listItems.length > 0 && filteredListItems.length === 0}
        label="검색 결과가 없습니다"
        description="프로그램명, 태그, 설명으로 다시 검색해 보세요."
      />

      {(!hasStoreQuery || marketListItems.length > 0 || (isStoreSettled && listItems.length === 0)) && (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>공식 프로그램</h2>
          </div>
          <EmptyStateRows
            when={isStoreSettled && !error && !hasStoreQuery && marketListItems.length === 0}
            label="표시할 프로그램이 없습니다"
          />
          {marketListItems.length > 0 && (
            <div>
              {marketListItems.map((item) => (
                <ProgramListCard
                  key={item.key}
                  item={item}
                  onPress={() => {
                    setDetailTargetId(item.template.id);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {customListItems.length > 0 || (!hasStoreQuery && customProgramCount > 0) ? (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>내 프로그램</h2>
          </div>
          <div>
            {customListItems.map((item) => (
              <ProgramListCard
                key={item.key}
                item={item}
                onPress={() => {
                  setDetailTargetId(item.template.id);
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginBottom: "var(--space-lg)" }}>
        <div style={{ marginBottom: "var(--space-sm)" }}>
          <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>프로그램 만들기</h2>
        </div>
        <button
          type="button"
          onClick={openCreateSheet}
          style={{ width: "100%", background: "var(--color-action)", color: "#fff", border: "none", borderRadius: 14, padding: "var(--space-md)", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
        >
          <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.2px" }}>새 프로그램 만들기</span>
          <span style={{ fontSize: "12px", opacity: 0.82 }}>기존 프로그램 복사 또는 빈 템플릿에서 시작</span>
        </button>
      </section>

      <BottomSheet
        open={Boolean(detailTarget)}
        title="프로그램 상세"
        description=""
        onClose={() => setDetailTargetId(null)}
        closeLabel="닫기"
        footer={
          detailTarget ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", paddingTop: "var(--space-xs)" }}>
              <PrimaryButton
                type="button"
                variant="primary"
                fullWidth
                disabled={saving || !detailTarget.template.latestVersion}
                onClick={() => {
                  openStartProgramDraft(detailTarget.template);
                }}
              >
                이 프로그램으로 시작하기
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  setCustomizeDraft({
                    name: `${formatProgramDisplayName(detailTarget.template.name)} Custom`,
                    baseTemplate: detailTarget.template,
                    sessions: inferSessionDraftsFromTemplate(detailTarget.template),
                  });
                }}
              >
                커스터마이징해서 사용하기
              </PrimaryButton>
              {detailTarget.source === "CUSTOM" ? (
                <PrimaryButton
                  type="button"
                  variant="danger"
                  fullWidth
                  disabled={saving}
                  onClick={() => {
                    void deleteCustomTemplate(detailTarget);
                  }}
                >
                  커스텀 프로그램 삭제
                </PrimaryButton>
              ) : null}
            </div>
          ) : null
        }
      >
        {detailTarget && (() => {
          const info = getProgramDetailInfo(detailTarget.template);
          const badge = sourceBadgeMeta(detailTarget.source);
          const tags = Array.isArray(detailTarget.template.tags) ? detailTarget.template.tags : [];
          const sectionLabelStyle = {
            display: "block",
            color: "var(--text-session-context)",
            font: "var(--font-secondary)",
            marginBottom: "var(--space-xs)",
          } as const;
          const bodyTextStyle = {
            color: "var(--text-program-name)",
            font: "var(--font-body)",
            lineHeight: 1.55,
            margin: 0,
          } as const;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>

              {/* 헤더 */}
              <Card padding="md" elevated={false} tone="inset">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* INFO COLOR: program-name — 상세 헤더에서 프로그램명이 최우선 */}
                    <strong style={{ display: "block", font: "var(--font-card-title)", color: "var(--text-program-name)" }}>
                    {formatProgramDisplayName(detailTarget.template.name)}
                    </strong>
                  </div>
                  <span className={`${badge.className} label-sm`}>{badge.label}</span>
                </div>
              </Card>

              {/* 스탯 그리드 */}
              <Card padding="md" elevated={false}>
                {info.stats.map((stat, index) => (
                  <div
                    key={stat.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      padding: "6px 0",
                      borderBottom: index < info.stats.length - 1 ? "1px solid var(--color-border)" : "none",
                    }}
                  >
                    <span
                      style={{ color: "var(--text-session-context)", font: "var(--font-secondary)" }}
                    >
                      {stat.label}
                    </span>
                    <span
                      style={{ color: "var(--text-metric-weight)", font: "var(--font-card-title)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </Card>

              {/* 프로그램 소개 */}
              {detailTarget.template.description && (
                <Card padding="md" elevated={false}>
                  <span style={sectionLabelStyle}>프로그램 소개</span>
                  <p style={bodyTextStyle}>
                    {detailTarget.template.description}
                  </p>
                </Card>
              )}

              {/* 진행 설정 (Operator) */}
              {info.progressionNote && (
                <Card tone="subtle" padding="md" elevated={false}>
                  <span className="label label-tag-progression label-sm">진행 설정</span>
                  <p style={{ ...bodyTextStyle, color: "var(--text-meta)", marginTop: "var(--space-xs)" }}>{info.progressionNote}</p>
                </Card>
              )}

              {/* 훈련 모듈 (Operator) */}
              {info.modules && info.modules.length > 0 && (
                <Card padding="md" elevated={false}>
                  <span style={sectionLabelStyle}>훈련 모듈</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
                    {info.modules.map((mod) => (
                      <div
                        key={mod}
                        style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}
                      >
                        <span className="label label-muscle-group label-sm">
                          {mod}
                        </span>
                        <span style={{ color: "var(--text-program-name)" }}>
                          {MODULE_NAMES[mod] ?? mod}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 세션 구성 (Manual) */}
              {info.sessions && info.sessions.length > 0 && (
                <Card padding="md" elevated={false}>
                  <span style={sectionLabelStyle}>세션 구성</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginTop: "var(--space-xs)" }}>
                    {info.sessions.map((session) => (
                      <div
                        key={session.key}
                        style={{ border: "1px solid var(--color-border)", borderRadius: "10px", overflow: "hidden" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-xs)",
                            padding: "var(--space-xs) var(--space-sm)",
                            background: "var(--color-surface-2)",
                            borderBottom: "1px solid var(--color-border)",
                          }}
                        >
                          <span className="label label-program label-sm">
                            {/* INFO COLOR: session-context */}
                            {session.key}
                          </span>
                          <span style={{ color: "var(--text-session-name)" }}>
                            세션 {session.key}
                          </span>
                        </div>
                        <div style={{ padding: "var(--space-sm)" }}>
                          {session.exercises.map((ex, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", padding: "2px 0" }}>
                              <span style={{ color: "var(--text-exercise-name)" }}>
                                {ex.name}
                              </span>
                              {ex.setsReps && (
                                <span
                                  style={{ color: "var(--text-metric-reps)" }}
                                >
                                  {ex.setsReps}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 태그 */}
              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
                  {/* INFO COLOR: tag semantic — 상세 모달에서도 동일한 분류 적용 */}
                  {tags.map((tag) => (
                    <span key={tag} className={tagLabelClass(tag)}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

            </div>
          );
        })()}
      </BottomSheet>

      <BottomSheet
        open={Boolean(startProgramDraft)}
        title="시작 전 1RM 입력"
        description="모든 종목의 1RM 입력이 필수입니다."
        onClose={() => setStartProgramDraft(null)}
        closeLabel="닫기"
        primaryAction={
          startProgramDraft
            ? {
                ariaLabel: saving ? "1RM 저장 후 시작 중" : "1RM 저장 후 시작",
                onPress: () => {
                  void submitStartProgram();
                },
                disabled: saving,
              }
            : null
        }
        footer={null}
      >
        {startProgramDraft ? (
          <div>
            <Card padding="sm" elevated={false}>
              <CardHeader>
                <CardTitle>{formatProgramDisplayName(startProgramDraft.template.name)}</CardTitle>
                <div>
                TM 계산 비율: {Math.round(startProgramDraft.tmPercent * 100)}%
                </div>
              </CardHeader>
            </Card>
            {startProgramDraft.recommendationStatus === "loading" ? (
              <p>운동 종목별 1RM 통계 기반 추천값 계산 중...</p>
            ) : null}
            {startProgramDraft.recommendationMessage ? (
              <p>{startProgramDraft.recommendationMessage}</p>
            ) : null}
            {startProgramDraft.targets.map((target) => (
              <div key={target.key}>
                <span>
                  {target.label} 1RM (kg)
                </span>
                <NumberPickerField
                  label={`${target.label} 1RM`}
                  value={Number(startProgramDraft.oneRmInputs[target.key]) || 0}
                  min={0}
                  max={500}
                  step={0.5}
                  unit="kg"
                  variant="workout-number"
                  formatValue={(v) => v.toFixed(1)}
                  onChange={(v) =>
                    setStartProgramDraft((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        oneRmInputs: {
                          ...prev.oneRmInputs,
                          [target.key]: String(v),
                        },
                      };
                    })
                  }
                />
                {startProgramDraft.recommendations[target.key] ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "6px" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                      추천 {formatKg(startProgramDraft.recommendations[target.key].recommendedKg)}kg
                      {" · "}
                      최근 e1RM {formatKg(startProgramDraft.recommendations[target.key].latestE1rmKg)}kg
                    </span>
                    <button
                      type="button"
                      className="btn btn-inline-action btn-inline-action-primary"
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
              </div>
            ))}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(customizeDraft)}
        title="커스터마이징"
        description={
          customizeDraft
            ? `기본 구성 편집 · ${customizeDraft.baseTemplate.name}`
            : ""
        }
        onClose={() => setCustomizeDraft(null)}
        closeLabel="닫기"
        primaryAction={
          customizeDraft
            ? {
                ariaLabel: saving ? "커스터마이징 프로그램 저장 중" : "커스터마이징 프로그램 저장",
                onPress: () => {
                  void saveCustomizationDraft(customizeDraft);
                },
                disabled: saving,
              }
            : null
        }
        footer={null}
      >
        {customizeDraft && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span style={{ color: "var(--text-session-context)", font: "var(--font-secondary)" }}>프로그램 이름</span>
              <AppTextInput
                variant="workout"
                value={customizeDraft.name}
                onChange={(event) =>
                  setCustomizeDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>

            <Card tone="subtle" padding="sm" elevated={false}>
              <CardHeader style={{ marginBottom: 0 }}>
                <CardTitle>기본 구성</CardTitle>
                {isOperatorCustomization ? (
                  <>
                    <CardDescription>D1/D2는 `Squat + Bench + Pull-Up`, D3는 `Squat + Bench + Deadlift` 기준으로 시작합니다.</CardDescription>
                    <CardDescription>세션 순서는 고정하고, 각 day의 종목만 교체/추가/삭제할 수 있게 정리했습니다.</CardDescription>
                  </>
                ) : (
                  <CardDescription>기존 세션 구성을 기반으로 시작합니다. 각 세션의 종목을 교체/추가/삭제할 수 있습니다.</CardDescription>
                )}
              </CardHeader>
            </Card>

            <Card padding="sm" elevated={false}>
              <CardHeader style={{ marginBottom: "var(--space-md)" }}>
                <CardTitle>Day별 종목 변경</CardTitle>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {customizeDraft.sessions.map((session) => {
                const meta = operatorSessionMeta(session.key);
                const summary = session.exercises
                  .map((exercise) => exercise.exerciseName.trim())
                  .filter(Boolean)
                  .join(" + ");

                return (
                <Card
                  key={session.id}
                  padding="none"
                  tone="inset"
                  elevated={false}
                  style={{ padding: "var(--space-sm)", marginBottom: 0 }}
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
                  <header style={{ marginBottom: "var(--space-sm)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <strong>{meta.title}</strong>
                      <span style={{ color: "var(--text-meta)", font: "var(--font-secondary)" }}>
                        {summary || meta.description}
                      </span>
                    </div>
                  </header>

                  {session.exercises.length === 0 && (
                    <div>운동이 없습니다.</div>
                  )}

                  {session.exercises.map((exercise, exerciseIndex) => (
                    <div
                      key={exercise.id}
                      style={{ marginTop: exerciseIndex === 0 ? 0 : "var(--space-sm)" }}
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
                        operatorStyle={true}
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
                    className="btn btn-secondary btn-full"
                    style={{ marginTop: "var(--space-sm)" }}
                    onClick={() => {
                      const addedExercise = createEmptyExerciseDraft(null, "CUSTOM");
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
                    <span aria-hidden="true">
                      +
                    </span>
                    <span>운동 추가</span>
                  </button>
                </Card>
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
        primaryAction={
          createDraft
            ? {
                ariaLabel: saving ? "프로그램 생성 중" : "프로그램 생성",
                onPress: () => {
                  void saveCreateDraft(createDraft);
                },
                disabled: saving,
              }
            : null
        }
        footer={null}
      >
        {createDraft && (
          <div>
            <label>
              <span>프로그램 이름</span>
              <AppTextInput
                variant="workout"
                value={createDraft.name}
                onChange={(event) =>
                  setCreateDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
                placeholder="예: My Upper/Lower Custom"
              />
            </label>

            <div>
              <button
                type="button"
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
              <div>
                <button
                  type="button"
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
                <div>
                  <span>세션 개수 (1~4)</span>
                  <NumberPickerField
                    label="세션 개수"
                    value={createDraft.rule.count}
                    min={1}
                    max={4}
                    step={1}
                    variant="workout-number"
                    onChange={(v) =>
                      setCreateDraft((prev) => {
                        if (!prev) return prev;
                        const nextRule: SessionRule = { type: "NUMERIC", count: v };
                        return {
                          ...prev,
                          rule: nextRule,
                          sessions: reconcileSessionsByKeys(prev.sessions, makeSessionKeys(nextRule)),
                        };
                      })
                    }
                  />
                </div>
              )}
              </CardContent>
            </Card>

            <Card padding="sm" elevated={false}>
              <CardHeader>
                <CardTitle>세션 안에 운동종목 배치</CardTitle>
              </CardHeader>
              <CardContent>
              {createDraft.sessions.map((session) => (
                <Card
                  key={session.id}
                  padding="none"
                  tone="inset"
                  elevated={false}
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
                  <header>
                    <strong>세션 {session.key}</strong>
                  </header>

                  {session.exercises.length === 0 && (
                    <div>운동이 없습니다.</div>
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
                    <span aria-hidden="true">
                      +
                    </span>
                    <span>운동 추가</span>
                  </button>
                </Card>
              ))}
              </CardContent>
            </Card>
          </div>
        )}
      </BottomSheet>
    </PullToRefreshShell>
  );
}
