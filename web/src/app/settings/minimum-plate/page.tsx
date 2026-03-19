"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { AppNumberStepper, AppTextInput } from "@/components/ui/form-controls";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { EmptyStateRows, ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet } from "@/lib/api";
import { createPersistServerSetting, fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import {
  DEFAULT_MINIMUM_PLATE_KG,
  normalizeIncrementKg,
  parseMinimumPlateRules,
  serializeMinimumPlateRules,
  SETTINGS_KEYS,
  type MinimumPlateRule,
} from "@/lib/settings/workout-preferences";

type ExerciseOption = {
  id: string;
  name: string;
  category: string | null;
};

type ExerciseResponse = {
  items: ExerciseOption[];
};

type RuleDraft = {
  exerciseId: string | null;
  exerciseName: string;
  incrementKg: number;
};

function compareRules(a: MinimumPlateRule, b: MinimumPlateRule) {
  return a.exerciseName.localeCompare(b.exerciseName, "ko");
}

function toRuleKey(rule: MinimumPlateRule) {
  return rule.exerciseId ? `id:${rule.exerciseId}` : `name:${rule.exerciseName.toLowerCase()}`;
}

function dedupeRules(rules: MinimumPlateRule[]) {
  const map = new Map<string, MinimumPlateRule>();
  for (const rule of rules) {
    map.set(toRuleKey(rule), rule);
  }
  return Array.from(map.values()).sort(compareRules);
}

export default function SettingsMinimumPlatePage() {
  const [loading, setLoading] = useState(true);
  const [settingsLoadKey, setSettingsLoadKey] = useState("minimum-plate:init");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [defaultDraftKg, setDefaultDraftKg] = useState(DEFAULT_MINIMUM_PLATE_KG);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRuleKey, setEditingRuleKey] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>({
    exerciseId: null,
    exerciseName: "",
    incrementKg: DEFAULT_MINIMUM_PLATE_KG,
  });
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [serverDefaultKg, setServerDefaultKg] = useState(DEFAULT_MINIMUM_PLATE_KG);
  const [serverRulesJson, setServerRulesJson] = useState("[]");

  const defaultIncrement = useSettingRowMutation<number>({
    key: SETTINGS_KEYS.minimumPlateDefaultKg,
    fallbackValue: DEFAULT_MINIMUM_PLATE_KG,
    serverValue: serverDefaultKg,
    persistServer: createPersistServerSetting<number>(),
    successMessage: "기본 최소 원판 무게를 저장했습니다.",
    rollbackNotice: "기본 최소 원판 저장 실패로 이전 값으로 되돌렸습니다.",
  });

  const rulesSetting = useSettingRowMutation<string>({
    key: SETTINGS_KEYS.minimumPlateRulesJson,
    fallbackValue: "[]",
    serverValue: serverRulesJson,
    persistServer: createPersistServerSetting<string>(),
    successMessage: "종목별 최소 원판 규칙을 저장했습니다.",
    rollbackNotice: "규칙 저장 실패로 이전 값으로 되돌렸습니다.",
  });

  const rules = useMemo(() => parseMinimumPlateRules(rulesSetting.value), [rulesSetting.value]);

  const visibleExercises = useMemo(() => {
    const query = exerciseQuery.trim().toLowerCase();
    if (!query) return exercises;
    return exercises.filter((exercise) => {
      const full = `${exercise.name} ${exercise.category ?? ""}`.toLowerCase();
      return full.includes(query);
    });
  }, [exerciseQuery, exercises]);
  const selectedExerciseOption = useMemo(
    () => (ruleDraft.exerciseId ? exercises.find((exercise) => exercise.id === ruleDraft.exerciseId) ?? null : null),
    [ruleDraft.exerciseId, exercises],
  );
  const isSettingsSettled = useQuerySettled(settingsLoadKey, loading);

  const latestNotice = defaultIncrement.notice ?? rulesSetting.notice ?? null;
  const hasSaveError = Boolean(defaultIncrement.error || rulesSetting.error);
  const normalizedDefaultDraftKg = normalizeIncrementKg(defaultDraftKg, DEFAULT_MINIMUM_PLATE_KG);
  const canSaveDefault = !defaultIncrement.pending && normalizedDefaultDraftKg !== normalizeIncrementKg(defaultIncrement.value, DEFAULT_MINIMUM_PLATE_KG);
  const canSaveRule = !rulesSetting.pending && Boolean(ruleDraft.exerciseId);

  const loadSettingsAndExercises = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setSettingsLoadKey(`minimum-plate:${Date.now()}`);
      const [snapshot, exerciseRes] = await Promise.all([
        fetchSettingsSnapshot(),
        apiGet<ExerciseResponse>("/api/exercises?limit=250"),
      ]);
      const nextDefaultKg = normalizeIncrementKg(
        snapshot[SETTINGS_KEYS.minimumPlateDefaultKg],
        DEFAULT_MINIMUM_PLATE_KG,
      );
      const rulesRaw = snapshot[SETTINGS_KEYS.minimumPlateRulesJson];
      const nextRulesJson = serializeMinimumPlateRules(parseMinimumPlateRules(rulesRaw));
      setServerDefaultKg(nextDefaultKg);
      setDefaultDraftKg(nextDefaultKg);
      setServerRulesJson(nextRulesJson);
      setExercises(exerciseRes.items ?? []);
    } catch (e: any) {
      setLoadError(e?.message ?? "최소 원판 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettingsAndExercises();
  }, [loadSettingsAndExercises]);

  useEffect(() => {
    if (defaultIncrement.pending) return;
    setDefaultDraftKg(normalizeIncrementKg(defaultIncrement.value, DEFAULT_MINIMUM_PLATE_KG));
  }, [defaultIncrement.pending, defaultIncrement.value]);

  const saveDefaultIncrement = useCallback(async () => {
    const result = await defaultIncrement.commit(normalizedDefaultDraftKg);
    if (!result.ignored && result.ok) {
      setServerDefaultKg(result.value);
    }
  }, [defaultIncrement, normalizedDefaultDraftKg]);

  const openCreateSheet = () => {
    setEditingRuleKey(null);
    setRuleDraft({
      exerciseId: null,
      exerciseName: "",
      incrementKg: normalizeIncrementKg(defaultIncrement.value, DEFAULT_MINIMUM_PLATE_KG),
    });
    setExerciseQuery("");
    setSheetError(null);
    setSheetOpen(true);
  };

  const openEditSheet = (rule: MinimumPlateRule) => {
    const matchedExercise =
      exercises.find((exercise) => exercise.name.trim().toLowerCase() === rule.exerciseName.trim().toLowerCase()) ??
      null;
    setEditingRuleKey(toRuleKey(rule));
    setRuleDraft({
      exerciseId: matchedExercise?.id ?? rule.exerciseId,
      exerciseName: matchedExercise?.name ?? rule.exerciseName,
      incrementKg: normalizeIncrementKg(rule.incrementKg, DEFAULT_MINIMUM_PLATE_KG),
    });
    setExerciseQuery("");
    setSheetError(null);
    setSheetOpen(true);
  };

  const selectExerciseOption = useCallback((option: ExerciseOption | null) => {
    setRuleDraft((prev) => ({
      ...prev,
      exerciseId: option?.id ?? null,
      exerciseName: option?.name ?? "",
    }));
    setExerciseQuery("");
    setSheetError(null);
  }, []);

  const saveRule = async () => {
    if (!ruleDraft.exerciseId) {
      setSheetError("드롭다운에서 운동종목을 선택하세요.");
      return;
    }
    const selectedExercise = exercises.find((exercise) => exercise.id === ruleDraft.exerciseId) ?? null;
    const exerciseName = (selectedExercise?.name ?? ruleDraft.exerciseName).trim();
    if (!exerciseName) {
      setSheetError("선택한 운동종목 정보를 확인하세요.");
      return;
    }

    const nextRule: MinimumPlateRule = {
      exerciseId: ruleDraft.exerciseId,
      exerciseName,
      incrementKg: normalizeIncrementKg(ruleDraft.incrementKg, DEFAULT_MINIMUM_PLATE_KG),
    };

    const filtered = editingRuleKey ? rules.filter((rule) => toRuleKey(rule) !== editingRuleKey) : rules;
    const nextRules = dedupeRules([...filtered, nextRule]);
    const result = await rulesSetting.commit(serializeMinimumPlateRules(nextRules));
    if (!result.ignored && result.ok) {
      setServerRulesJson(result.value);
      setSheetOpen(false);
    }
  };

  const deleteRule = async () => {
    if (!editingRuleKey) return;
    const nextRules = rules.filter((rule) => toRuleKey(rule) !== editingRuleKey);
    const result = await rulesSetting.commit(serializeMinimumPlateRules(nextRules));
    if (!result.ignored && result.ok) {
      setServerRulesJson(result.value);
      setSheetOpen(false);
    }
  };

  return (
    <div>
      {loading && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "35%", marginBottom: 12 }} />
          <div className="card" style={{ padding: "var(--space-md)" }}>

            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 12, borderBottom: i < 2 ? "1px solid var(--color-border)" : "none" }}>
                <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 14, width: "40%" }} />
                <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 28, width: 64 }} />
              </div>
            ))}
          </div>
        </div>
      )}
      <ErrorStateRows
        message={loadError}
        title="최소 원판 설정 조회 실패"
        onRetry={() => {
          void loadSettingsAndExercises();
        }}
      />
      <NoticeStateRows message={latestNotice} tone={hasSaveError ? "warning" : "success"} label="최소 원판 안내" />

      <section>
        <SectionHeader title="기본 최소 원판 무게" description="기본값은 규칙이 없는 모든 종목에 적용됩니다." />
        <BaseGroupedList ariaLabel="Default minimum plate setting">
          <ValueRow
            label="기본 Increment"
            description="운동종목별 규칙이 없을 때 사용"
            value={`${normalizeIncrementKg(defaultIncrement.value).toFixed(2)} kg`}
            showChevron={false}
          />
        </BaseGroupedList>
      </section>

      <section>
        <SectionHeader title="기본값 조절" description="스테퍼로 조절한 뒤 저장 버튼으로 반영합니다." />
        <Card padding="md" elevated={false}>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <AppNumberStepper
              label="기본 최소 원판 (kg)"
              value={defaultDraftKg}
              min={0.25}
              max={25}
              step={0.25}
              inputMode="decimal"
              onChange={(next) => setDefaultDraftKg(normalizeIncrementKg(next, DEFAULT_MINIMUM_PLATE_KG))}
            />
            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={() => {
                void saveDefaultIncrement();
              }}
              disabled={!canSaveDefault}
            >
              {defaultIncrement.pending ? "저장 중..." : "기본값 저장"}
            </button>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="종목별 최소 원판 규칙" description="예: Pull-up 1.25kg, 나머지 2.5kg" />
        <BaseGroupedList ariaLabel="Per exercise minimum plate rules">
          {rules.map((rule) => (
            <NavigationRow
              key={toRuleKey(rule)}
              label={rule.exerciseName}
              subtitle={rule.exerciseId ? "DB 종목 연결" : "이름 기반 규칙"}
              description="탭해서 increment 수정/삭제"
              value={`${rule.incrementKg.toFixed(2)}kg`}
              onPress={() => openEditSheet(rule)}
            />
          ))}
          <NavigationRow
            label="종목별 규칙 추가"
            subtitle="Add Rule"
            description="운동종목을 선택하고 최소 원판 무게를 지정합니다."
            onPress={openCreateSheet}
            value="추가"
          />
        </BaseGroupedList>
        <EmptyStateRows
          when={isSettingsSettled && rules.length === 0}
          label="종목별 규칙이 없습니다"
          description="기본값만 사용 중입니다. 필요하면 규칙을 추가하세요."
          ariaLabel="Minimum plate rule empty state"
        />
        <SectionFootnote>
          저장된 규칙은 기록 화면의 무게 입력 시 자동으로 스냅되어 적용됩니다.
        </SectionFootnote>
      </section>

      <BottomSheet
        open={sheetOpen}
        title={editingRuleKey ? "종목별 최소 원판 규칙 편집" : "종목별 최소 원판 규칙 추가"}
        description="운동종목을 선택하고 증가 단위를 설정하세요."
        onClose={() => setSheetOpen(false)}
        closeLabel="닫기"
        primaryAction={{
          ariaLabel: rulesSetting.pending ? "규칙 저장 중" : "규칙 저장",
          onPress: () => {
            void saveRule();
          },
          disabled: !canSaveRule,
        }}
        footer={
          editingRuleKey ? (
            <div>
              <button
                type="button"
                className="btn btn-danger btn-full"
                onClick={() => void deleteRule()}
                disabled={rulesSetting.pending}
              >
                규칙 삭제
              </button>
            </div>
          ) : null
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <Card padding="md" elevated={false}>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>운동종목 드롭다운 검색/선택</span>
                <div data-no-swipe="true">
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        insetInlineStart: "0.82rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "0.9rem",
                        height: "0.9rem",
                        color: "var(--color-text-subtle)",
                        pointerEvents: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg viewBox="0 0 24 24" focusable="false" style={{ width: "100%", height: "100%", fill: "none", stroke: "currentColor", strokeWidth: "2" }}>
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.8-3.8" />
                      </svg>
                    </span>
                    <AppTextInput
                      type="text"
                      inputMode="search"
                      autoComplete="off"
                      value={exerciseQuery}
                      style={{ paddingInlineStart: "2.15rem", paddingInlineEnd: exerciseQuery.trim().length > 0 ? "2.25rem" : "var(--space-md)" }}
                      placeholder="예: Pull-up"
                      onChange={(event) => {
                        const nextQuery = event.target.value;
                        setExerciseQuery(nextQuery);
                        setSheetError(null);
                        setRuleDraft((prev) => {
                          if (!prev.exerciseId) return prev;
                          if (nextQuery.trim().toLowerCase() === prev.exerciseName.trim().toLowerCase()) return prev;
                          return { ...prev, exerciseId: null, exerciseName: "" };
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const first = visibleExercises[0] ?? null;
                        if (!first) return;
                        selectExerciseOption(first);
                      }}
                    />
                    {exerciseQuery.trim().length > 0 ? (
                      <button
                        type="button"
                        aria-label="검색어 지우기"
                        style={{
                          position: "absolute",
                          insetInlineEnd: "0.55rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "24px",
                          height: "24px",
                          minHeight: "24px",
                          borderRadius: "999px",
                          border: "1px solid var(--color-border)",
                          background: "var(--color-surface-secondary)",
                          color: "var(--color-text-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          lineHeight: 0,
                        }}
                        onClick={() => {
                          setExerciseQuery("");
                          setSheetError(null);
                        }}
                      >
                        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <path d="M2 2 10 10" />
                          <path d="M10 2 2 10" />
                        </svg>
                      </button>
                    ) : null}
                  </div>

                  {selectedExerciseOption ? (
                    <div
                      role="status"
                      aria-live="polite"
                      style={{
                        marginTop: "var(--space-sm)",
                        padding: "var(--space-sm)",
                        border: "1px solid var(--color-selected-border)",
                        borderRadius: "8px",
                        background: "var(--color-selected-weak)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--space-sm)",
                      }}
                    >
                      <strong style={{ minWidth: 0 }}>
                        {selectedExerciseOption.category
                          ? `${selectedExerciseOption.name} · ${selectedExerciseOption.category}`
                          : selectedExerciseOption.name}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-inline-action"
                        onClick={() => selectExerciseOption(null)}
                      >
                        선택 변경
                      </button>
                    </div>
                  ) : null}

                  {!selectedExerciseOption ? (
                    <div
                      role="listbox"
                      aria-label="운동종목 검색 결과"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-xs)",
                        maxHeight: "240px",
                        overflowY: "auto",
                        paddingTop: "var(--space-sm)",
                      }}
                    >
                      {visibleExercises.length === 0 ? (
                        <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>검색 조건에 맞는 운동종목이 없습니다.</span>
                      ) : (
                        visibleExercises.map((exercise) => (
                          <button
                            key={exercise.id}
                            type="button"
                            className="btn btn-secondary btn-full"
                            style={{ justifyContent: "flex-start", minHeight: "40px" }}
                            onClick={() => {
                              selectExerciseOption(exercise);
                            }}
                          >
                            {exercise.category ? `${exercise.name} · ${exercise.category}` : exercise.name}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </label>
            </CardContent>
          </Card>

          <Card padding="md" elevated={false}>
            <CardContent>
              <AppNumberStepper
                label="최소 원판 Increment (kg)"
                value={ruleDraft.incrementKg}
                min={0.25}
                max={25}
                step={0.25}
                inputMode="decimal"
                onChange={(next) =>
                  setRuleDraft((prev) => ({
                    ...prev,
                    incrementKg: normalizeIncrementKg(next, DEFAULT_MINIMUM_PLATE_KG),
                  }))
                }
              />
            </CardContent>
          </Card>

          {sheetError ? <p style={{ margin: 0, color: "var(--color-danger)", font: "var(--font-secondary)" }}>{sheetError}</p> : null}
        </div>
      </BottomSheet>
    </div>
  );
}
