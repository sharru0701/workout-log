"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { AppNumberStepper, AppTextInput } from "@/components/ui/form-controls";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
  SectionHeader,
} from "@/components/settings/settings-home-content";
import { EmptyStateRows, ErrorStateRows } from "@/components/ui/settings-state";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import {
  DEFAULT_MINIMUM_PLATE_KG,
  normalizeIncrementKg,
  useMinimumPlateRulesSetting,
} from "@/lib/settings/minimum-plate-rules";
import { apiGet } from "@/lib/api";

type ExerciseCatalogItem = {
  id: string;
  name: string;
  category?: string;
};

export default function MinimumPlatePage() {
  const rulesSetting = useMinimumPlateRulesSetting();
  const isSettingsSettled = useQuerySettled("settings:minimum-plate", rulesSetting.loading);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRuleKey, setEditingRuleKey] = useState<string | null>(null);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [ruleDraft, setRuleDraft] = useState({ exerciseId: "", exerciseName: "", incrementKg: DEFAULT_MINIMUM_PLATE_KG });
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const rules = useMemo(() => {
    return Object.entries(rulesSetting.value).map(([id, incrementKg]) => ({
      exerciseId: id,
      exerciseName: rulesSetting.nameMap[id] || id,
      incrementKg,
    }));
  }, [rulesSetting.value, rulesSetting.nameMap]);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      const res = await apiGet<{ items: ExerciseCatalogItem[] }>("/api/exercises");
      setCatalog(res.items);
    } catch {
      // Ignore
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const visibleExercises = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((ex) => ex.name.toLowerCase().includes(q) || ex.category?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [catalog, exerciseQuery]);

  const selectedExerciseOption = useMemo(() => {
    if (!ruleDraft.exerciseId) return null;
    return catalog.find((ex) => ex.id === ruleDraft.exerciseId) ?? { id: ruleDraft.exerciseId, name: ruleDraft.exerciseName };
  }, [catalog, ruleDraft.exerciseId, ruleDraft.exerciseName]);

  function openAddSheet() {
    setEditingRuleKey(null);
    setExerciseQuery("");
    setRuleDraft({ exerciseId: "", exerciseName: "", incrementKg: DEFAULT_MINIMUM_PLATE_KG });
    setSheetError(null);
    setSheetOpen(true);
  }

  function openEditSheet(exerciseId: string, name: string, incrementKg: number) {
    setEditingRuleKey(exerciseId);
    setExerciseQuery(name);
    setRuleDraft({ exerciseId, exerciseName: name, incrementKg });
    setSheetError(null);
    setSheetOpen(true);
  }

  function selectExerciseOption(exercise: ExerciseCatalogItem | null) {
    if (!exercise) {
      setRuleDraft((prev) => ({ ...prev, exerciseId: "", exerciseName: "" }));
      return;
    }
    setRuleDraft((prev) => ({ ...prev, exerciseId: exercise.id, exerciseName: exercise.name }));
    setExerciseQuery(exercise.name);
    setSheetError(null);
  }

  async function saveRule() {
    if (!ruleDraft.exerciseId) {
      setSheetError("운동종목을 선택해주세요.");
      return;
    }
    try {
      await rulesSetting.update({
        ...rulesSetting.value,
        [ruleDraft.exerciseId]: ruleDraft.incrementKg,
      }, { [ruleDraft.exerciseId]: ruleDraft.exerciseName });
      setSheetOpen(false);
    } catch (e: any) {
      setSheetError(e?.message || "규칙 저장에 실패했습니다.");
    }
  }

  async function deleteRule() {
    if (!editingRuleKey) return;
    try {
      const nextValue = { ...rulesSetting.value };
      delete nextValue[editingRuleKey];
      await rulesSetting.update(nextValue);
      setSheetOpen(false);
    } catch (e: any) {
      setSheetError(e?.message || "규칙 삭제에 실패했습니다.");
    }
  }

  const canSaveRule = Boolean(ruleDraft.exerciseId) && !rulesSetting.pending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
      <section>
        <SectionHeader
          title="종목별 최소 원판(Increment) 규칙"
          description="특정 운동에 대해 기본값 대신 사용할 최소 증량 단위(kg)를 지정합니다."
        />
        <BaseGroupedList>
          <NavigationRow
            label="새 규칙 추가"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
            onClick={openAddSheet}
          />
        </BaseGroupedList>

        <BaseGroupedList title="설정된 규칙 목록">
          {rules.map((rule) => (
            <NavigationRow
              key={rule.exerciseId}
              label={rule.exerciseName}
              value={`${rule.incrementKg.toFixed(2)}kg`}
              onClick={() => openEditSheet(rule.exerciseId, rule.exerciseName, rule.incrementKg)}
            />
          ))}
        </BaseGroupedList>

        <ErrorStateRows message={rulesSetting.error ? "규칙을 불러오지 못했습니다." : null} />
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

      <Modal
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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)", paddingLeft: "4px" }}>운동종목 드롭다운 검색/선택</span>
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
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
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
          </div>

          {sheetError ? <p style={{ margin: 0, color: "var(--color-danger)", font: "var(--font-secondary)", padding: "0 4px" }}>{sheetError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
