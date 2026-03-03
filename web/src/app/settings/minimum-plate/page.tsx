"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet } from "@/lib/api";
import { createPersistServerSetting, fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { useSettingRowMutation } from "@/lib/settings/use-setting-row-mutation";
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

function nextIncrement(value: number, delta: number) {
  return normalizeIncrementKg(value + delta, DEFAULT_MINIMUM_PLATE_KG);
}

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

  const latestNotice = defaultIncrement.notice ?? rulesSetting.notice ?? null;
  const hasSaveError = Boolean(defaultIncrement.error || rulesSetting.error);

  const loadSettingsAndExercises = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
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
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={120}
        label="최소 원판 설정 로딩 중"
        description="종목 목록과 저장된 최소 원판 규칙을 확인하고 있습니다."
      />
      <ErrorStateRows
        message={loadError}
        title="최소 원판 설정 조회 실패"
        onRetry={() => {
          void loadSettingsAndExercises();
        }}
      />
      <NoticeStateRows message={latestNotice} tone={hasSaveError ? "warning" : "success"} label="최소 원판 안내" />

      <section className="grid gap-2">
        <SectionHeader title="기본 최소 원판 무게" description="기본값은 규칙이 없는 모든 종목에 적용됩니다." />
        <BaseGroupedList ariaLabel="Default minimum plate setting">
          <ValueRow
            label="기본 Increment"
            description="운동종목별 규칙이 없을 때 사용"
            value={`${normalizeIncrementKg(defaultIncrement.value).toFixed(2)} kg`}
            showChevron={false}
            leading={<RowIcon symbol="DF" tone="neutral" />}
          />
          <NavigationRow
            label="기본값 -0.25kg"
            description="스텝으로 빠르게 조절"
            onPress={() => setDefaultDraftKg((prev) => nextIncrement(prev, -0.25))}
            showChevron={false}
            leading={<RowIcon symbol="-0.25" tone="neutral" />}
          />
          <NavigationRow
            label="기본값 +0.25kg"
            description="스텝으로 빠르게 조절"
            onPress={() => setDefaultDraftKg((prev) => nextIncrement(prev, 0.25))}
            showChevron={false}
            leading={<RowIcon symbol="+0.25" tone="neutral" />}
          />
        </BaseGroupedList>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="기본값 수동 입력" description="숫자 키패드로 직접 설정할 수 있습니다." />
        <article className="motion-card rounded-2xl border p-4 grid gap-3">
          <label className="grid gap-1">
            <span className="ui-card-label">기본 최소 원판 (kg)</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="decimal"
              min={0.25}
              max={25}
              step={0.25}
              value={defaultDraftKg}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setDefaultDraftKg(normalizeIncrementKg(next, DEFAULT_MINIMUM_PLATE_KG));
              }}
            />
          </label>
          <button
            type="button"
            className="ui-primary-button"
            disabled={defaultIncrement.pending}
            onClick={async () => {
              const result = await defaultIncrement.commit(normalizeIncrementKg(defaultDraftKg, DEFAULT_MINIMUM_PLATE_KG));
              if (!result.ignored && result.ok) {
                setServerDefaultKg(result.value);
              }
            }}
          >
            {defaultIncrement.pending ? "저장 중..." : "기본값 저장"}
          </button>
        </article>
      </section>

      <section className="grid gap-2">
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
              leading={<RowIcon symbol="PL" tone="blue" />}
            />
          ))}
          <NavigationRow
            label="종목별 규칙 추가"
            subtitle="Add Rule"
            description="운동종목을 선택하고 최소 원판 무게를 지정합니다."
            onPress={openCreateSheet}
            value="추가"
            leading={<RowIcon symbol="+R" tone="tint" />}
          />
        </BaseGroupedList>
        <EmptyStateRows
          when={!loading && rules.length === 0}
          label="종목별 규칙이 없습니다"
          description="기본값만 사용 중입니다. 필요하면 규칙을 추가하세요."
          ariaLabel="Minimum plate rule empty state"
        />
        <SectionFootnote>
          저장된 규칙은 Workout Record 무게 입력 시 자동으로 스냅되어 적용됩니다.
        </SectionFootnote>
      </section>

      <BottomSheet
        open={sheetOpen}
        title={editingRuleKey ? "종목별 최소 원판 규칙 편집" : "종목별 최소 원판 규칙 추가"}
        description="운동종목을 선택하고 increment를 설정하세요."
        onClose={() => setSheetOpen(false)}
        closeLabel="닫기"
        className="stats-sheet stats-sheet--large"
        footer={
          <div className="grid gap-2">
            <button type="button" className="ui-primary-button" onClick={() => void saveRule()} disabled={rulesSetting.pending}>
              {rulesSetting.pending ? "저장 중..." : "규칙 저장"}
            </button>
            {editingRuleKey ? (
              <button
                type="button"
                className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold text-[var(--color-danger)]"
                onClick={() => void deleteRule()}
                disabled={rulesSetting.pending}
              >
                규칙 삭제
              </button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="ui-card-label">운동종목 드롭다운 검색/선택</span>
            <div className="workout-combobox" data-no-swipe="true">
              <div className="app-search-shell">
                <span className="app-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.8-3.8" />
                  </svg>
                </span>
                <input
                  type="search"
                  inputMode="search"
                  className="app-search-input"
                  value={exerciseQuery}
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
                    className="app-search-clear"
                    aria-label="검색어 지우기"
                    onClick={() => {
                      setExerciseQuery("");
                      setSheetError(null);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {selectedExerciseOption ? (
                <div className="workout-combobox-selected" role="status" aria-live="polite">
                  <span className="workout-combobox-selected-kicker">선택됨</span>
                  <strong className="workout-combobox-selected-name">
                    {selectedExerciseOption.category
                      ? `${selectedExerciseOption.name} · ${selectedExerciseOption.category}`
                      : selectedExerciseOption.name}
                  </strong>
                  <button
                    type="button"
                    className="haptic-tap workout-combobox-selected-edit"
                    onClick={() => selectExerciseOption(null)}
                  >
                    선택 변경
                  </button>
                </div>
              ) : null}

              {!selectedExerciseOption ? (
                <div className="workout-combobox-panel" role="listbox" aria-label="운동종목 검색 결과">
                  {visibleExercises.length === 0 ? (
                    <span className="workout-combobox-empty">검색 조건에 맞는 운동종목이 없습니다.</span>
                  ) : (
                    visibleExercises.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        className={`haptic-tap workout-combobox-option${ruleDraft.exerciseId === exercise.id ? " is-active" : ""}`}
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

          <label className="grid gap-1">
            <span className="ui-card-label">최소 원판 Increment (kg)</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="decimal"
              min={0.25}
              max={25}
              step={0.25}
              value={ruleDraft.incrementKg}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setRuleDraft((prev) => ({
                  ...prev,
                  incrementKg: normalizeIncrementKg(next, DEFAULT_MINIMUM_PLATE_KG),
                }));
              }}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold"
              onClick={() =>
                setRuleDraft((prev) => ({
                  ...prev,
                  incrementKg: nextIncrement(prev.incrementKg, -0.25),
                }))
              }
            >
              -0.25kg
            </button>
            <button
              type="button"
              className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold"
              onClick={() =>
                setRuleDraft((prev) => ({
                  ...prev,
                  incrementKg: nextIncrement(prev.incrementKg, 0.25),
                }))
              }
            >
              +0.25kg
            </button>
          </div>

          {sheetError ? <p className="text-sm text-[var(--color-danger)]">{sheetError}</p> : null}
        </div>
      </BottomSheet>
    </div>
  );
}
