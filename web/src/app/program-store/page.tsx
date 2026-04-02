"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ExerciseEditorRow from "./_components/program-exercise-editor-row";
import { ProgramDetailSheet } from "./_components/program-detail-sheet";
import { useLocale } from "@/components/locale-provider";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card } from "@/components/ui/card";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { NumberPickerField } from "@/components/ui/number-picker-sheet";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyStateRows, ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, isAbortError } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";

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

function storeCategories(locale: "ko" | "en") {
  return [
    { key: "all", label: locale === "ko" ? "전체" : "All" },
    { key: "strength", label: locale === "ko" ? "근력" : "Strength" },
    { key: "hypertrophy", label: locale === "ko" ? "근비대" : "Hypertrophy" },
    { key: "beginner", label: locale === "ko" ? "입문" : "Beginner" },
    { key: "endurance", label: locale === "ko" ? "지구력" : "Endurance" },
  ] as const;
}

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

function programCardBadge(item: ProgramListItem, locale: "ko" | "en"): { label: string; style: React.CSSProperties } {
  const tags = (item.template.tags ?? []).map((t) => t.toLowerCase());
  const isBeginnerProgram = tags.some((t) => ["novice", "beginner", "입문", "초보"].includes(t));
  if (item.source === "CUSTOM") {
    return {
      label: locale === "ko" ? "커스텀" : "Custom",
      style: {
        background: "color-mix(in srgb, var(--color-secondary) 15%, transparent)",
        color: "var(--color-secondary)",
        border: "1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)",
      },
    };
  }
  if (isBeginnerProgram) {
    return {
      label: locale === "ko" ? "입문 추천" : "Beginner Pick",
      style: {
        background: "color-mix(in srgb, var(--color-tertiary) 15%, transparent)",
        color: "var(--color-tertiary)",
        border: "1px solid color-mix(in srgb, var(--color-tertiary) 20%, transparent)",
      },
    };
  }
  return {
    label: locale === "ko" ? "공식" : "Official",
    style: {
      background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
      color: "var(--color-primary)",
      border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
    },
  };
}

function ProgramListCard({
  item,
  onPress,
}: {
  item: ProgramListItem;
  onPress: () => void;
}) {
  const { locale } = useLocale();
  const info = getProgramDetailInfo(item.template, locale);
  const tags = Array.isArray(item.template.tags) ? item.template.tags : [];
  const isMarket = item.source === "MARKET";

  const badge = programCardBadge(item, locale);

  const difficultyStat = info.stats.find((s) => s.key === "difficulty");
  const frequencyStat = info.stats.find((s) => s.key === "frequency");
  const cycleStat = info.stats.find((s) => s.key === "cycle");
  const splitStat = info.stats.find((s) => s.key === "split");
  const periodStat = info.stats.find((s) => s.key === "duration");

  const levelLabel = difficultyStat?.value ?? (locale === "ko" ? "일반" : "Standard");
  const frequencyLabel = frequencyStat?.value ?? splitStat?.value ?? null;
  const durationLabel = cycleStat?.value ?? periodStat?.value ?? null;

  const intensityMap: Record<string, number> = {
    Beginner: 2,
    Intermediate: 3,
    Advanced: 4,
    Standard: 3,
    초급: 2,
    중급: 3,
    고급: 4,
    일반: 3,
  };
  const intensityFill = intensityMap[levelLabel] ?? 3;

  const metaItems = [
    durationLabel ? { icon: "calendar_today", label: locale === "ko" ? "기간" : "Duration", value: durationLabel } : null,
    frequencyLabel ? { icon: "event_repeat", label: locale === "ko" ? "빈도" : "Frequency", value: frequencyLabel } : null,
    { icon: "leaderboard", label: locale === "ko" ? "난이도" : "Difficulty", value: levelLabel },
  ].filter((m): m is { icon: string; label: string; value: string } => m !== null);

  const badgeLabelStyle: React.CSSProperties = {
    fontFamily: "var(--font-label-family)",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 8px",
    borderRadius: 4,
    display: "inline-block",
    ...badge.style,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPress(); }}
      style={{
        background: "var(--color-surface-container-low)",
        borderRadius: 16,
        padding: "var(--space-lg)",
        cursor: "pointer",
        marginBottom: "var(--space-md)",
        outline: "none",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-container)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-container-low)"; }}
      onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-container)"; }}
      onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-container-low)"; }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-sm)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={badgeLabelStyle}>{badge.label}</span>
          {/* INFO COLOR: plan-name */}
          <h2 style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "20px",
            fontWeight: 800,
            letterSpacing: "-0.3px",
            color: "var(--text-plan-name)",
            margin: "var(--space-xs) 0 2px",
            lineHeight: 1.2,
          }}>
            {formatProgramDisplayName(item.name)}
          </h2>
          {item.subtitle ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
              {item.subtitle}
            </p>
          ) : null}
        </div>
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", flexShrink: 0, marginLeft: "var(--space-sm)" }}>
            {/* INFO COLOR: tag semantic */}
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className={tagLabelClass(tag)}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {item.description ? (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-sm)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.description}
        </p>
      ) : null}

      {/* Meta info */}
      {metaItems.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)", marginBottom: "var(--space-md)", background: "var(--color-surface-container-lowest)", padding: "var(--space-sm) var(--space-md)", borderRadius: 10 }}>
          {metaItems.map((meta) => (
            <div key={meta.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-subtle)" }}>
                {meta.label}
              </span>
              <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text)", display: "flex", alignItems: "center", gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{meta.icon}</span>
                {meta.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Intensity bar + CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)" }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-subtle)", display: "block", marginBottom: 6 }}>
            {locale === "ko" ? "강도" : "Intensity"}
          </span>
          <div style={{ display: "flex", gap: 3 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: 6,
                  flex: 1,
                  borderRadius: 9999,
                  background: i <= intensityFill ? "var(--color-primary)" : "var(--color-surface-container-highest)",
                }}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPress(); }}
          style={{
            background: isMarket ? "var(--color-action)" : "var(--color-surface-container-highest)",
            color: isMarket ? "#fff" : "var(--color-text)",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontFamily: "var(--font-headline-family)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {isMarket ? (locale === "ko" ? "시작하기" : "Start") : (locale === "ko" ? "편집" : "Edit")}
        </button>
      </div>
    </div>
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

function validateCustomSessions(sessions: ProgramSessionDraft[], locale: "ko" | "en") {
  const errors: string[] = [];
  if (!hasAtLeastOneExercise(sessions)) {
    errors.push(locale === "ko" ? "최소 1개 운동을 추가해야 합니다." : "Add at least one exercise.");
  }
  sessions.forEach((session) => {
    session.exercises.forEach((exercise, index) => {
      if (!exerciseValidity(exercise)) {
        errors.push(
          locale === "ko"
            ? `세션 ${session.key}의 ${index + 1}번째 운동 입력값을 확인해 주세요.`
            : `Review the inputs for exercise ${index + 1} in session ${session.key}.`,
        );
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

function operatorSessionMeta(sessionKey: string, locale: "ko" | "en") {
  const key = String(sessionKey ?? "").trim().toUpperCase();
  if (key === "D1") return { title: "D1", description: locale === "ko" ? "스쿼트 + 벤치 + 풀업" : "Squat + Bench + Pull-Up" };
  if (key === "D2") return { title: "D2", description: locale === "ko" ? "스쿼트 + 벤치 + 풀업" : "Squat + Bench + Pull-Up" };
  if (key === "D3") return { title: "D3", description: locale === "ko" ? "스쿼트 + 벤치 + 데드리프트" : "Squat + Bench + Deadlift" };
  if (key === "D4") return { title: "D4", description: locale === "ko" ? "오버헤드 프레스" : "Overhead Press" };
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
  const { locale, copy } = useLocale();
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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
  const categoryOptions = useMemo(() => storeCategories(locale), [locale]);

  const listItems = useMemo(() => toProgramListItems(templates, locale), [locale, templates]);
  const filteredListItems = useMemo(() => {
    const normalizedQuery = storeQuery.trim().toLowerCase();
    if (!normalizedQuery) return listItems;
    return listItems.filter((item) => {
      const scheduleLabel = getProgramScheduleLabel(item.template, locale);
      const tags = Array.isArray(item.template.tags) ? item.template.tags.join(" ") : "";
      return normalizeSearchText(
        formatProgramDisplayName(item.name),
        item.subtitle,
        item.description,
        scheduleLabel,
        tags,
      ).includes(normalizedQuery);
    });
  }, [listItems, locale, storeQuery]);
  const categoryFilteredItems = useMemo(() => {
    if (categoryFilter === "all") return filteredListItems;
    return filteredListItems.filter((item) => {
      const tags = (item.template.tags ?? []).map((t) => t.toLowerCase()).join(" ");
      switch (categoryFilter) {
        case "strength": return tags.includes("strength") || tags.includes("근력") || tags.includes("power");
        case "hypertrophy": return tags.includes("hypertrophy") || tags.includes("근비대");
        case "beginner": return tags.includes("beginner") || tags.includes("novice") || tags.includes("입문") || tags.includes("초보");
        case "endurance": return tags.includes("endurance") || tags.includes("지구력");
        default: return true;
      }
    });
  }, [filteredListItems, categoryFilter]);

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
    () => categoryFilteredItems.filter((entry) => entry.source === "MARKET"),
    [categoryFilteredItems],
  );
  const customListItems = useMemo(
    () => categoryFilteredItems.filter((entry) => entry.source === "CUSTOM"),
    [categoryFilteredItems],
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
            ? (locale === "ko"
              ? "추천값을 찾았습니다. 필요하면 종목별로 추천값 적용을 눌러 반영하세요."
              : "Recommendations are ready. Apply them to each lift if needed.")
            : (locale === "ko" ? "적용 가능한 1RM 추천값이 없습니다." : "No 1RM recommendations are available yet."),
        };
      });
    } catch (e: any) {
      if (isAbortError(e) || oneRmRecommendationControllerRef.current !== controller) return;
      setStartProgramDraft((prev) => {
        if (!prev || prev.template.id !== templateId) return prev;
        return {
          ...prev,
          recommendationStatus: "failed",
          recommendationMessage: e?.message ?? (locale === "ko" ? "1RM 추천값을 불러오지 못했습니다." : "Could not load 1RM recommendations."),
        };
      });
    } finally {
      if (oneRmRecommendationControllerRef.current === controller) {
        oneRmRecommendationControllerRef.current = null;
      }
    }
  }, [locale]);

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
      setError(e?.message ?? (locale === "ko" ? "프로그램 데이터를 불러오지 못했습니다." : "Could not load program data."));
    } finally {
      if (storeLoadControllerRef.current === controller) {
        storeLoadControllerRef.current = null;
        setLoading(false);
      }
    }
  }, [locale]);

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
          name: locale === "ko"
            ? `${formatProgramDisplayName(item.template.name)} 커스텀`
            : `${formatProgramDisplayName(item.template.name)} Custom`,
          baseTemplate: item.template,
          sessions: inferSessionDraftsFromTemplate(item.template),
        });
      }
    }
    if (createFlag === "1" && templates.length > 0) {
      setCreateDraft(buildInitialCreateDraft(templates));
    }
  }, [listItems, locale, queryState.create, queryState.customize, queryState.detail, templates]);

  const openStartProgramDraft = useCallback(
    (template: ProgramTemplate) => {
      if (!template.latestVersion) {
        setError(locale === "ko" ? "선택한 프로그램의 버전 정보가 없습니다." : "The selected program has no version data.");
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
    [loadOneRmRecommendations, locale, plans],
  );

  const submitStartProgram = useCallback(async () => {
    if (!startProgramDraft) return;

    const oneRepMaxKg: Record<string, number> = {};
    const trainingMaxKg: Record<string, number> = {};
    for (const target of startProgramDraft.targets) {
      const parsed = parsePositiveNumber(startProgramDraft.oneRmInputs[target.key] ?? "");
      if (parsed === null) {
        setError(locale === "ko" ? `${target.label} 1RM을 kg 기준으로 입력하세요.` : `Enter ${target.label} 1RM in kg.`);
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
          name: locale === "ko"
            ? `${formatProgramDisplayName(startProgramDraft.template.name)} 프로그램`
            : `${formatProgramDisplayName(startProgramDraft.template.name)} Program`,
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
        throw new Error(locale === "ko" ? "플랜 생성/갱신 결과가 올바르지 않습니다." : "The plan create/update result was invalid.");
      }

      void loadStore({ isRefresh: true });
      setStartProgramDraft(null);
      router.push(
        `/workout/log?planId=${encodeURIComponent(targetPlanId)}&date=${startProgramDraft.today}&context=today`,
      );
    } catch (e: any) {
      setError(e?.message ?? (locale === "ko" ? "프로그램을 시작하지 못했습니다." : "Could not start the program."));
    } finally {
      setSaving(false);
    }
  }, [loadStore, locale, plans, router, startProgramDraft]);

  const deleteCustomTemplate = useCallback(
    async (item: ProgramListItem) => {
      if (item.source !== "CUSTOM") return;
      const confirmed = await confirm({
        title: locale === "ko" ? "커스텀 프로그램 삭제" : "Delete Custom Program",
        message: locale === "ko"
          ? `커스텀 프로그램 "${item.template.name}"을(를) 삭제할까요?\n연결된 내 플랜도 함께 삭제됩니다.`
          : `Delete custom program "${item.template.name}"?\nConnected plans will also be deleted.`,
        confirmText: locale === "ko" ? "삭제" : "Delete",
        cancelText: locale === "ko" ? "취소" : "Cancel",
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
            ? (locale === "ko" ? ` (연결 플랜 ${res.deletedPlanCount}개 삭제)` : ` (${res.deletedPlanCount} linked plan${res.deletedPlanCount === 1 ? "" : "s"} deleted)`)
            : "";

        setDetailTargetId(null);
        setCustomizeDraft(null);
        setStartProgramDraft(null);
        
        // 백그라운드 동기화용 (화면 로딩 없음)
        void loadStore({ isRefresh: true });
        setNotice(
          locale === "ko"
            ? `커스텀 프로그램을 삭제했습니다: ${formatProgramDisplayName(item.template.name)}${deletedPlanSuffix}`
            : `Deleted custom program: ${formatProgramDisplayName(item.template.name)}${deletedPlanSuffix}`,
        );
      } catch (e: any) {
        setError(e?.message ?? (locale === "ko" ? "커스텀 프로그램을 삭제하지 못했습니다." : "Could not delete the custom program."));
        // 실패 시 데이터 원상복구
        void loadStore({ isRefresh: true });
      } finally {
        setSaving(false);
      }
    },
    [confirm, loadStore, locale],
  );

  const saveCustomizationDraft = useCallback(
    async (draft: CustomizeDraft) => {
      const errors = validateCustomSessions(draft.sessions, locale);
      if (!draft.name.trim()) {
        errors.push(locale === "ko" ? "커스터마이징 프로그램 이름을 입력하세요." : "Enter a name for the customized program.");
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
          throw new Error(locale === "ko" ? "세션 커스터마이징용 Manual 템플릿을 찾지 못했습니다." : "Could not find a Manual template for session customization.");
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

        setNotice(
          locale === "ko"
            ? `커스터마이징 프로그램을 만들었습니다: ${formatProgramDisplayName(fork.template.name)}`
            : `Created customized program: ${formatProgramDisplayName(fork.template.name)}`,
        );
        setCustomizeDraft(null);
        setDetailTargetId(null);
        
        void loadStore({ isRefresh: true });
      } catch (e: any) {
        setError(e?.message ?? (locale === "ko" ? "커스터마이징을 저장하지 못했습니다." : "Could not save the customization."));
      } finally {
        setSaving(false);
      }
    },
    [loadStore, locale, manualPublicTemplate],
  );

  const saveCreateDraft = useCallback(
    async (draft: CreateDraft) => {
      const errors = validateCustomSessions(draft.sessions, locale);
      if (!draft.name.trim()) {
        errors.push(locale === "ko" ? "프로그램 이름을 입력하세요." : "Enter a program name.");
      }

      let sourceSlug: string | null = null;
      if (draft.mode === "MARKET_BASED") {
        sourceSlug = draft.sourceTemplateSlug;
      } else {
        sourceSlug = manualPublicTemplate?.slug ?? null;
      }
      if (!sourceSlug) {
        errors.push(locale === "ko" ? "기반 프로그램을 찾지 못했습니다." : "Could not find the base program.");
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

        setNotice(
          locale === "ko"
            ? `커스텀 프로그램을 만들었습니다: ${formatProgramDisplayName(fork.template.name)}`
            : `Created custom program: ${formatProgramDisplayName(fork.template.name)}`,
        );
        setCreateDraft(null);
        void loadStore({ isRefresh: true });
      } catch (e: any) {
        setError(e?.message ?? (locale === "ko" ? "커스텀 프로그램을 만들지 못했습니다." : "Could not create the custom program."));
      } finally {
        setSaving(false);
      }
    },
    [loadStore, locale, manualPublicTemplate?.slug],
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
    <>
      <div style={{ marginBottom: "var(--space-xl)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-primary)", marginBottom: "4px" }}>{copy.programStore.eyebrow}</div>
        <h1 style={{ fontFamily: "var(--font-headline-family)", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "0 0 var(--space-sm)" }}>{copy.programStore.title}</h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>{copy.programStore.description}</p>
      </div>

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
                <div key={i} style={{ background: "var(--color-surface-container-low)", borderRadius: 16, padding: "var(--space-lg)" }}>
                  {/* badge + title */}
                  <div style={{ ...skeletonStyle, height: 18, width: "18%", marginBottom: "var(--space-sm)", borderRadius: 4 }} />
                  <div style={{ ...skeletonStyle, height: 22, width: "65%", marginBottom: "var(--space-xs)" }} />
                  <div style={{ ...skeletonStyle, height: 14, width: "40%", marginBottom: "var(--space-md)", borderRadius: 4 }} />
                  {/* meta row */}
                  <div style={{ display: "flex", gap: "var(--space-md)", background: "var(--color-surface-container-lowest)", padding: "var(--space-sm) var(--space-md)", borderRadius: 10, marginBottom: "var(--space-md)" }}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ ...skeletonStyle, height: 10, width: 36, borderRadius: 4 }} />
                        <div style={{ ...skeletonStyle, height: 14, width: 56, borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                  {/* intensity + cta */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...skeletonStyle, height: 10, width: 32, marginBottom: 6, borderRadius: 4 }} />
                      <div style={{ display: "flex", gap: 3 }}>
                        {Array.from({ length: 5 }).map((_, k) => (
                          <div key={k} style={{ ...skeletonStyle, height: 6, flex: 1, borderRadius: 9999 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ ...skeletonStyle, height: 40, width: 88, borderRadius: 10 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <ErrorStateRows
        message={error}
        title={copy.programStore.loadError}
        onRetry={() => {
          void loadStore();
        }}
      />
      <NoticeStateRows message={notice} label={copy.programStore.notice} />

      {listItems.length > 0 || hasStoreQuery ? (
        <SearchInput
          value={storeQuery}
          onChange={setStoreQuery}
          placeholder={copy.programStore.searchPlaceholder}
          ariaLabel={copy.programStore.searchAriaLabel}
        />
      ) : null}

      {/* Category Filter Chips */}
      {listItems.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            overflowX: "auto",
            paddingBottom: "var(--space-xs)",
            marginBottom: "var(--space-md)",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          } as React.CSSProperties}
        >
          {categoryOptions.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategoryFilter(cat.key)}
              style={{
                padding: "8px 20px",
                borderRadius: 9999,
                border: categoryFilter === cat.key ? "none" : "1px solid var(--color-border)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-label-family)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                flexShrink: 0,
                background: categoryFilter === cat.key ? "var(--color-primary-container)" : "var(--color-surface-container-low)",
                color: categoryFilter === cat.key ? "var(--color-on-primary)" : "var(--color-text-muted)",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <EmptyStateRows
        when={isStoreSettled && !error && listItems.length > 0 && filteredListItems.length === 0}
        label={copy.programStore.emptySearch}
        description={copy.programStore.emptySearchDescription}
      />

      <EmptyStateRows
        when={isStoreSettled && !error && filteredListItems.length > 0 && categoryFilteredItems.length === 0}
        label={locale === "ko" ? "해당 카테고리의 프로그램이 없습니다" : "No programs in this category"}
        description={locale === "ko" ? "다른 카테고리를 선택하거나 전체를 확인해 보세요." : "Try a different category or browse all programs."}
      />

      {(!hasStoreQuery || marketListItems.length > 0 || (isStoreSettled && listItems.length === 0)) && (
        <section style={{ marginBottom: "var(--space-lg)" }}>
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
              {locale === "ko" ? "공식 프로그램" : "Official Programs"}
            </h2>
          </div>
          <EmptyStateRows
            when={isStoreSettled && !error && !hasStoreQuery && marketListItems.length === 0}
            label={locale === "ko" ? "표시할 프로그램이 없습니다" : "No programs to show"}
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
            <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
              {locale === "ko" ? "내 프로그램" : "My Programs"}
            </h2>
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
          <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
            {locale === "ko" ? "프로그램 만들기" : "Create Program"}
          </h2>
        </div>
        <button
          type="button"
          onClick={openCreateSheet}
          style={{ width: "100%", background: "var(--color-action)", color: "#fff", border: "none", borderRadius: 14, padding: "var(--space-md)", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
        >
          <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.2px" }}>
            {locale === "ko" ? "새 프로그램 만들기" : "Create a New Program"}
          </span>
          <span style={{ fontSize: "12px", opacity: 0.82 }}>
            {locale === "ko" ? "기존 프로그램을 바탕으로 시작하거나 직접 새 구조를 만드세요." : "Start from an existing program or build a fresh structure from scratch."}
          </span>
        </button>
      </section>

      <ProgramDetailSheet
        open={Boolean(detailTarget)}
        onClose={() => setDetailTargetId(null)}
        item={detailTarget}
        saving={saving}
        onStart={() => {
          if (detailTarget) openStartProgramDraft(detailTarget.template);
        }}
        onCustomize={() => {
          if (detailTarget) {
            setCustomizeDraft({
              name: locale === "ko"
                ? `${formatProgramDisplayName(detailTarget.template.name)} 커스텀`
                : `${formatProgramDisplayName(detailTarget.template.name)} Custom`,
              baseTemplate: detailTarget.template,
              sessions: inferSessionDraftsFromTemplate(detailTarget.template),
            });
          }
        }}
        onDelete={
          detailTarget?.source === "CUSTOM"
            ? () => { void deleteCustomTemplate(detailTarget!); }
            : undefined
        }
      />

      <BottomSheet
        open={Boolean(startProgramDraft)}
        title={locale === "ko" ? "시작 전 1RM 입력" : "Enter 1RM Before Starting"}
        description={locale === "ko" ? "모든 종목의 1RM 입력이 필수입니다." : "A 1RM entry is required for each lift."}
        onClose={() => setStartProgramDraft(null)}
        closeLabel={locale === "ko" ? "닫기" : "Close"}
        primaryAction={
          startProgramDraft
            ? {
                ariaLabel: saving ? (locale === "ko" ? "1RM 저장 후 시작 중" : "Saving 1RM and starting") : (locale === "ko" ? "1RM 저장 후 시작" : "Save 1RM and Start"),
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <Card padding="md" tone="accent" elevated={false}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)" }}>
                <strong style={{ fontFamily: "var(--font-headline-family)", fontSize: "15px", fontWeight: 700, color: "var(--color-text)" }}>
                  {formatProgramDisplayName(startProgramDraft.template.name)}
                </strong>
                <span className="label label-tag-progression label-sm">
                  TM {Math.round(startProgramDraft.tmPercent * 100)}%
                </span>
              </div>
            </Card>
            {startProgramDraft.recommendationStatus === "loading" ? (
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
                {locale === "ko" ? "운동 종목별 1RM 통계 기반 추천값 계산 중..." : "Calculating recommendations from your 1RM history..."}
              </p>
            ) : null}
            {startProgramDraft.recommendationMessage ? (
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>{startProgramDraft.recommendationMessage}</p>
            ) : null}
            {startProgramDraft.targets.map((target) => (
              <div key={target.key} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <span style={{ fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
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
                      {locale === "ko" ? "추천" : "Recommended"} {formatKg(startProgramDraft.recommendations[target.key].recommendedKg)}kg
                      {" · "}
                      {locale === "ko" ? "최근 e1RM" : "Latest e1RM"} {formatKg(startProgramDraft.recommendations[target.key].latestE1rmKg)}kg
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
                      {locale === "ko" ? "추천값 적용" : "Apply Recommendation"}
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
        title={locale === "ko" ? "커스터마이징" : "Customize"}
        description={
          customizeDraft
            ? (locale === "ko" ? `기본 구성 편집 · ${customizeDraft.baseTemplate.name}` : `Customize base setup · ${customizeDraft.baseTemplate.name}`)
            : ""
        }
        onClose={() => setCustomizeDraft(null)}
        closeLabel={locale === "ko" ? "닫기" : "Close"}
        primaryAction={
          customizeDraft
            ? {
                ariaLabel: saving ? (locale === "ko" ? "커스터마이징 프로그램 저장 중" : "Saving customized program") : (locale === "ko" ? "커스터마이징 프로그램 저장" : "Save Customized Program"),
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
              <span style={{ color: "var(--text-session-context)", font: "var(--font-secondary)" }}>
                {locale === "ko" ? "프로그램 이름" : "Program Name"}
              </span>
              <AppTextInput
                variant="workout"
                value={customizeDraft.name}
                onChange={(event) =>
                  setCustomizeDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>

            <Card tone="subtle" padding="md" elevated={false}>
              <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 var(--space-xs)" }}>
                {locale === "ko" ? "기본 구성" : "Base Setup"}
              </h2>
              {isOperatorCustomization ? (
                <>
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 4px", lineHeight: 1.5 }}>
                    {locale === "ko" ? "D1/D2는 스쿼트 + 벤치프레스 + 풀업, D3는 스쿼트 + 벤치프레스 + 데드리프트 구성을 기준으로 시작합니다." : "D1/D2 start from Squat + Bench + Pull-Up, and D3 starts from Squat + Bench + Deadlift."}
                  </p>
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
                    {locale === "ko" ? "세션 순서는 유지되고, 각 day 안에서 종목만 교체·추가·삭제할 수 있습니다." : "Session order stays fixed, and you can swap, add, or remove exercises inside each day."}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
                  {locale === "ko" ? "기존 세션 구성을 기반으로 시작합니다. 각 세션의 종목을 교체/추가/삭제할 수 있습니다." : "Start from the current session structure. You can swap, add, or remove exercises in each session."}
                </p>
              )}
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
                {locale === "ko" ? "Day별 종목 변경" : "Adjust Exercises by Day"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {customizeDraft.sessions.map((session) => {
                const meta = operatorSessionMeta(session.key, locale);
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
                    <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "var(--space-xs) 0" }}>
                      {locale === "ko" ? "아직 추가된 운동이 없습니다." : "No exercises added yet."}
                    </p>
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
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, fontVariationSettings: "'wght' 400" }}>add</span>
                    <span>{locale === "ko" ? "운동 추가" : "Add Exercise"}</span>
                  </button>
                </Card>
              );
            })}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(createDraft)}
        title={locale === "ko" ? "새 프로그램 만들기" : "Create New Program"}
        description={locale === "ko" ? "공식 프로그램을 바탕으로 시작하거나 직접 새 구조를 만드세요." : "Start from an official program or build a fresh structure yourself."}
        onClose={() => setCreateDraft(null)}
        closeLabel={locale === "ko" ? "닫기" : "Close"}
        primaryAction={
          createDraft
            ? {
                ariaLabel: saving ? (locale === "ko" ? "프로그램 생성 중" : "Creating program") : (locale === "ko" ? "프로그램 생성" : "Create Program"),
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span style={{ fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                {locale === "ko" ? "프로그램 이름" : "Program Name"}
              </span>
              <AppTextInput
                variant="workout"
                value={createDraft.name}
                onChange={(event) =>
                  setCreateDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
                placeholder={locale === "ko" ? "예: 나만의 Upper/Lower" : "e.g. My Upper/Lower Custom"}
              />
            </label>

            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <button
                type="button"
                className={`btn btn-inline-action${createDraft.mode === "MARKET_BASED" ? " btn-inline-action-primary" : ""}`}
                onClick={() =>
                  setCreateDraft((prev) =>
                    prev ? { ...prev, mode: "MARKET_BASED" } : prev,
                  )
                }
              >
                {locale === "ko" ? "공식 기반" : "Start from Official"}
              </button>
              <button
                type="button"
                className={`btn btn-inline-action${createDraft.mode === "FULL_MANUAL" ? " btn-inline-action-primary" : ""}`}
                onClick={() =>
                  setCreateDraft((prev) =>
                    prev ? { ...prev, mode: "FULL_MANUAL" } : prev,
                  )
                }
              >
                {locale === "ko" ? "직접 구성" : "Build from Scratch"}
              </button>
            </div>

            {createDraft.mode === "MARKET_BASED" && (
              <AppSelect
                label={locale === "ko" ? "기반 공식 프로그램" : "Base Program"}
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
                <option value="">{locale === "ko" ? "선택" : "Select"}</option>
                {publicTemplates.map((template) => (
                  <option key={template.id} value={template.slug}>
                    {formatProgramDisplayName(template.name)}
                  </option>
                ))}
              </AppSelect>
            )}

            <Card padding="md" elevated={false} tone="subtle">
              <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 var(--space-sm)" }}>
                {locale === "ko" ? "세션 규칙" : "Session Rules"}
              </h2>
              <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                <button
                  type="button"
                  className={`btn btn-inline-action${createDraft.rule.type === "AB" ? " btn-inline-action-primary" : ""}`}
                  onClick={() =>
                    setCreateDraft((prev) => {
                      if (!prev) return prev;
                      const nextRule: SessionRule = { type: "AB", count: 2 };
                      return { ...prev, rule: nextRule, sessions: reconcileSessionsByKeys(prev.sessions, makeSessionKeys(nextRule)) };
                    })
                  }
                >
                  {locale === "ko" ? "A/B 분할" : "A/B Split"}
                </button>
                <button
                  type="button"
                  className={`btn btn-inline-action${createDraft.rule.type === "NUMERIC" ? " btn-inline-action-primary" : ""}`}
                  onClick={() =>
                    setCreateDraft((prev) => {
                      if (!prev) return prev;
                      const nextRule: SessionRule = { type: "NUMERIC", count: prev.rule.count || 2 };
                      return { ...prev, rule: nextRule, sessions: reconcileSessionsByKeys(prev.sessions, makeSessionKeys(nextRule)) };
                    })
                  }
                >
                  {locale === "ko" ? "숫자 분할" : "Numeric Split"}
                </button>
              </div>
              {createDraft.rule.type === "NUMERIC" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                  <span style={{ fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                    {locale === "ko" ? "세션 개수 (1~4)" : "Session Count (1-4)"}
                  </span>
                  <NumberPickerField
                    label={locale === "ko" ? "세션 개수" : "Session Count"}
                    value={createDraft.rule.count}
                    min={1}
                    max={4}
                    step={1}
                    variant="workout-number"
                    onChange={(v) =>
                      setCreateDraft((prev) => {
                        if (!prev) return prev;
                        const nextRule: SessionRule = { type: "NUMERIC", count: v };
                        return { ...prev, rule: nextRule, sessions: reconcileSessionsByKeys(prev.sessions, makeSessionKeys(nextRule)) };
                      })
                    }
                  />
                </div>
              )}
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
                {locale === "ko" ? "세션별 운동 배치" : "Exercise Layout by Session"}
              </h2>
              {createDraft.sessions.map((session) => (
                <Card
                  key={session.id}
                  padding="sm"
                  tone="inset"
                  elevated={false}
                  onDragOver={(event) => { event.preventDefault(); }}
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
                  <header style={{ marginBottom: "var(--space-sm)" }}>
                    <span className="label label-program label-sm">{locale === "ko" ? `세션 ${session.key}` : `Session ${session.key}`}</span>
                  </header>

                  {session.exercises.length === 0 && (
                    <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "var(--space-xs) 0" }}>
                      {locale === "ko" ? "아직 추가된 운동이 없습니다." : "No exercises added yet."}
                    </p>
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
                    className="btn btn-secondary btn-full"
                    style={{ marginTop: "var(--space-sm)" }}
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
                                createEmptyExerciseDraft(prev.mode === "MARKET_BASED" ? prev.sourceTemplateSlug : null),
                              ],
                            };
                          }),
                        };
                      })
                    }
                  >
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, fontVariationSettings: "'wght' 400" }}>add</span>
                    <span>{locale === "ko" ? "운동 추가" : "Add Exercise"}</span>
                  </button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
