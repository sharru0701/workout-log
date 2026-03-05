"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import {
  createEmptyExerciseDraft,
  extractOneRmTargetsFromTemplate,
  hasAtLeastOneExercise,
  inferSessionDraftsFromTemplate,
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
  return `${item.name} / ${item.subtitle}`;
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

function roundToNearest2p5(value: number) {
  return Math.round(value / 2.5) * 2.5;
}

function parsePositiveNumber(input: string) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function readOneRmFromPlanParams(params: any, key: string, tmPercent: number) {
  const oneRmRaw = Number(params?.oneRepMaxKg?.[key]);
  if (Number.isFinite(oneRmRaw) && oneRmRaw > 0) return oneRmRaw;
  const tmRaw = Number(params?.trainingMaxKg?.[key]);
  if (Number.isFinite(tmRaw) && tmRaw > 0 && tmPercent > 0) {
    return Math.round((tmRaw / tmPercent) * 100) / 100;
  }
  return null;
}

async function putProgramVersionDefinition(versionId: string, definition: any) {
  await apiPut(`/api/program-versions/${encodeURIComponent(versionId)}`, { definition });
}

function ExerciseEditorRow({
  exercise,
  publicTemplates,
  onPatch,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  exercise: ProgramExerciseDraft;
  publicTemplates: ProgramTemplate[];
  onPatch: (patch: Partial<ProgramExerciseDraft>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  return (
    <div className="workout-swipe-shell">
      <button type="button" className="workout-swipe-delete haptic-tap" onClick={onDelete}>
        삭제
      </button>
      <article
        className="workout-set-card grid gap-2"
        draggable
        onDragStart={onDragStart}
        onDragOver={(event) => {
          event.preventDefault();
          onDragOver();
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDrop();
        }}
      >
        <div className="program-store-row-head">
          <span className="ui-badge ui-badge-neutral">편집 모드</span>
          <span className="program-store-drag-handle" aria-hidden="true">
            ≡
          </span>
        </div>

        <label className="grid gap-1">
          <span className="ui-card-label">운동종목</span>
          <input
            className="workout-set-input workout-set-input-text"
            value={exercise.exerciseName}
            onChange={(event) => onPatch({ exerciseName: event.target.value })}
            placeholder="예: Back Squat"
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="ui-card-label">수행 방식</span>
            <select
              className="workout-set-input workout-set-input-text"
              value={exercise.mode}
              onChange={(event) =>
                onPatch({
                  mode: event.target.value === "MARKET" ? "MARKET" : "MANUAL",
                  marketTemplateSlug: event.target.value === "MARKET" ? exercise.marketTemplateSlug : null,
                })
              }
            >
              <option value="MARKET">시중 프로그램 기반</option>
              <option value="MANUAL">완전 수동</option>
            </select>
          </label>

          {exercise.mode === "MARKET" && (
            <label className="grid gap-1">
              <span className="ui-card-label">기반 프로그램</span>
              <select
                className="workout-set-input workout-set-input-text"
                value={exercise.marketTemplateSlug ?? ""}
                onChange={(event) => onPatch({ marketTemplateSlug: event.target.value || null })}
              >
                <option value="">선택</option>
                {publicTemplates.map((template) => (
                  <option key={template.id} value={template.slug}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="ui-card-label">세트</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={exercise.sets}
              onChange={(event) => onPatch({ sets: Math.max(1, Number(event.target.value) || 1) })}
            />
          </label>
          <label className="grid gap-1">
            <span className="ui-card-label">횟수</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={exercise.reps}
              onChange={(event) => onPatch({ reps: Math.max(1, Number(event.target.value) || 1) })}
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="ui-card-label">메모</span>
          <input
            className="workout-set-input workout-set-input-text"
            value={exercise.note}
            onChange={(event) => onPatch({ note: event.target.value })}
            placeholder="세션 메모"
          />
        </label>
      </article>
    </div>
  );
}

export default function ProgramStorePage() {
  const router = useRouter();

  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
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

  const loadStore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStoreLoadKey(`program-store:${Date.now()}`);
      const [templatesRes, plansRes] = await Promise.all([
        apiGet<TemplatesResponse>("/api/templates?limit=200"),
        apiGet<PlansResponse>("/api/plans"),
      ]);
      setTemplates(templatesRes.items ?? []);
      setPlans(plansRes.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Program Store 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    setQueryState(readSearchQueryFromLocation());
    const onPopState = () => {
      setQueryState(readSearchQueryFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
          name: `${item.template.name} Custom`,
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
      const tmPercentRaw = Number(template.latestVersion.defaults?.tmPercent);
      const tmPercent = Number.isFinite(tmPercentRaw) && tmPercentRaw > 0 ? tmPercentRaw : 1;
      const targets = extractOneRmTargetsFromTemplate(template);
      const oneRmInputs: Record<string, string> = {};
      for (const target of targets) {
        const preset = existing ? readOneRmFromPlanParams(existing.params, target.key, tmPercent) : null;
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
      });
      setError(null);
    },
    [plans],
  );

  const submitStartProgram = useCallback(async () => {
    if (!startProgramDraft) return;

    const oneRepMaxKg: Record<string, number> = {};
    for (const target of startProgramDraft.targets) {
      const parsed = parsePositiveNumber(startProgramDraft.oneRmInputs[target.key] ?? "");
      if (parsed === null) {
        setError(`${target.label} 1RM을 kg 기준으로 입력하세요.`);
        return;
      }
      oneRepMaxKg[target.key] = parsed;
    }

    const trainingMaxKg = Object.fromEntries(
      Object.entries(oneRepMaxKg).map(([key, oneRm]) => [key, roundToNearest2p5(oneRm * startProgramDraft.tmPercent)]),
    );

    try {
      setSaving(true);
      setNotice(null);
      const existing = startProgramDraft.existingPlanId
        ? plans.find((plan) => plan.id === startProgramDraft.existingPlanId) ?? null
        : null;

      let targetPlanId = startProgramDraft.existingPlanId;
      if (existing && targetPlanId) {
        await apiPatch<{ plan: PlanItem }>(`/api/plans/${encodeURIComponent(targetPlanId)}`, {
          params: {
            ...(existing.params ?? {}),
            startDate: startProgramDraft.today,
            timezone: startProgramDraft.timezone,
            sessionKeyMode: "DATE",
            oneRepMaxKg,
            trainingMaxKg,
          },
        });
      } else {
        const created = await apiPost<{ plan: PlanItem }>("/api/plans", {
          name: `${startProgramDraft.template.name} Program`,
          type: startProgramDraft.expectedPlanType,
          rootProgramVersionId: startProgramDraft.template.latestVersion!.id,
          params: {
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
        const fork = await apiPost<ForkResponse>(`/api/templates/${encodeURIComponent(draft.baseTemplate.slug)}/fork`, {
          newName: draft.name.trim(),
          newSlug: makeForkSlug(draft.name),
        });

        const definition = toManualDefinition(draft.sessions);
        await putProgramVersionDefinition(fork.version.id, definition);

        setNotice(`커스터마이징 프로그램 생성 완료: ${fork.template.name}`);
        setCustomizeDraft(null);
        setDetailTargetId(null);
        await loadStore();
      } catch (e: any) {
        setError(e?.message ?? "커스터마이징 저장에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [loadStore],
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

        setNotice(`커스텀 프로그램 생성 완료: ${fork.template.name}`);
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

  const openCreateSheet = () => {
    setError(null);
    setCreateDraft(buildInitialCreateDraft(templates));
  };

  const isStoreSettled = useQuerySettled(storeLoadKey, loading);

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={160}
        label="Program Store 로딩 중"
      />
      <ErrorStateRows
        message={error}
        title="Program Store 처리 실패"
        onRetry={() => {
          void loadStore();
        }}
      />
      <NoticeStateRows message={notice} label="Program Store 안내" />

      <section className="grid gap-2">
        <h2 className="ios-section-heading">프로그램 목록 (시중 + 커스텀)</h2>
        <EmptyStateRows
          when={isStoreSettled && !error && listItems.length === 0}
          label="표시할 프로그램이 없습니다"
        />
        {listItems.length > 0 && (
          <article className="motion-card rounded-2xl border p-4 grid gap-2">
            {listItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="haptic-tap rounded-xl border p-3 grid gap-1 text-left"
                onClick={() => {
                  setDetailTargetId(item.template.id);
                }}
              >
                <strong>{item.name}</strong>
              </button>
            ))}
          </article>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="ios-section-heading">나만의 커스터마이징 프로그램 추가</h2>
        <button
          type="button"
          className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold text-left"
          onClick={openCreateSheet}
        >
          프로그램 커스터마이징 모달 열기
        </button>
      </section>

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
                    name: `${detailTarget.template.name} Custom`,
                    baseTemplate: detailTarget.template,
                    sessions: inferSessionDraftsFromTemplate(detailTarget.template),
                  });
                }}
              >
                프로그램 커스터마이징
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget && (
          <div className="grid gap-2">
            <article className="rounded-xl border p-3 text-sm">
              <strong>{detailTarget.template.name}</strong>
              <p className="mt-1 text-[var(--text-secondary)]">
                타입: {detailTarget.template.type} / 최신 버전:{" "}
                {detailTarget.template.latestVersion ? `v${detailTarget.template.latestVersion.version}` : "-"}
              </p>
            </article>
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
            <article className="rounded-xl border p-3 text-sm grid gap-1">
              <strong>{startProgramDraft.template.name}</strong>
              <span className="ui-card-label">
                TM 계산 비율: {Math.round(startProgramDraft.tmPercent * 100)}%
              </span>
            </article>
            {startProgramDraft.targets.map((target) => (
              <label key={target.key} className="grid gap-1">
                <span className="ui-card-label">{target.label} 1RM (kg)</span>
                <input
                  className="workout-set-input workout-set-input-number"
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
              </label>
            ))}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(customizeDraft)}
        title="커스터마이징 모달"
        description={customizeDraft ? `컨텍스트: ${customizeDraft.baseTemplate.name}` : ""}
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
              <input
                className="workout-set-input workout-set-input-text"
                value={customizeDraft.name}
                onChange={(event) =>
                  setCustomizeDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>

            <article className="rounded-xl border p-3 grid gap-2">
              <strong>종목 순서 변경</strong>
            </article>

            <article className="rounded-xl border p-3 grid gap-3">
              <strong>세션별 종목 변경 (수정/삭제/추가)</strong>
              {customizeDraft.sessions.map((session) => (
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
                    <strong>세션 {session.key}</strong>
                    <button
                      type="button"
                      className="haptic-tap rounded-lg border px-3 py-2 text-sm"
                      onClick={() =>
                        setCustomizeDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            sessions: prev.sessions.map((entry) => {
                              if (entry.id !== session.id) return entry;
                              return {
                                ...entry,
                                exercises: [...entry.exercises, createEmptyExerciseDraft(prev.baseTemplate.slug)],
                              };
                            }),
                          };
                        })
                      }
                    >
                      + 운동 추가
                    </button>
                  </header>

                  {session.exercises.length === 0 && (
                    <div className="rounded-lg border p-3 text-sm text-[var(--text-secondary)]">운동이 없습니다.</div>
                  )}

                  {session.exercises.map((exercise) => (
                    <ExerciseEditorRow
                      key={exercise.id}
                      exercise={exercise}
                      publicTemplates={publicTemplates}
                      onPatch={(patch) =>
                        setCustomizeDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            sessions: prev.sessions.map((entry) => {
                              if (entry.id !== session.id) return entry;
                              return {
                                ...entry,
                                exercises: entry.exercises.map((item) =>
                                  item.id === exercise.id ? { ...item, ...patch } : item,
                                ),
                              };
                            }),
                          };
                        })
                      }
                      onDelete={() =>
                        setCustomizeDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            sessions: prev.sessions.map((entry) => {
                              if (entry.id !== session.id) return entry;
                              return {
                                ...entry,
                                exercises: entry.exercises.filter((item) => item.id !== exercise.id),
                              };
                            }),
                          };
                        })
                      }
                      onDragStart={() =>
                        setDragContext({
                          sourceSessionId: session.id,
                          sourceExerciseId: exercise.id,
                        })
                      }
                      onDragOver={() => {
                        // no-op: preventDefault handled in row.
                      }}
                      onDrop={() => applyDragReorder(session.id, exercise.id)}
                    />
                  ))}
                </div>
              ))}
            </article>
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
              <input
                className="workout-set-input workout-set-input-text"
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
              <label className="grid gap-1">
                <span className="ui-card-label">기반 시중 프로그램</span>
                <select
                  className="workout-set-input workout-set-input-text"
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
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <article className="rounded-xl border p-3 grid gap-2">
              <strong>세션 규칙 생성</strong>
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
                  <input
                    className="workout-set-input workout-set-input-number"
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
            </article>

            <article className="rounded-xl border p-3 grid gap-2">
              <strong>세션 안에 운동종목 배치</strong>
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
                    <button
                      type="button"
                      className="haptic-tap rounded-lg border px-3 py-2 text-sm"
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
                      + 운동종목 추가
                    </button>
                  </header>

                  {session.exercises.length === 0 && (
                    <div className="rounded-lg border p-3 text-sm text-[var(--text-secondary)]">운동이 없습니다.</div>
                  )}

                  {session.exercises.map((exercise) => (
                    <ExerciseEditorRow
                      key={exercise.id}
                      exercise={exercise}
                      publicTemplates={publicTemplates}
                      onPatch={(patch) =>
                        setCreateDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            sessions: prev.sessions.map((entry) => {
                              if (entry.id !== session.id) return entry;
                              return {
                                ...entry,
                                exercises: entry.exercises.map((item) =>
                                  item.id === exercise.id ? { ...item, ...patch } : item,
                                ),
                              };
                            }),
                          };
                        })
                      }
                      onDelete={() =>
                        setCreateDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            sessions: prev.sessions.map((entry) => {
                              if (entry.id !== session.id) return entry;
                              return {
                                ...entry,
                                exercises: entry.exercises.filter((item) => item.id !== exercise.id),
                              };
                            }),
                          };
                        })
                      }
                      onDragStart={() =>
                        setDragContext({
                          sourceSessionId: session.id,
                          sourceExerciseId: exercise.id,
                        })
                      }
                      onDragOver={() => {
                        // no-op
                      }}
                      onDrop={() => applyDragReorder(session.id, exercise.id)}
                    />
                  ))}
                </div>
              ))}
            </article>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
