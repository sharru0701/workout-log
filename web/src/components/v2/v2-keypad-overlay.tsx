"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useLocale } from "@/components/locale-provider";
import {
  draftAtom,
  programEntryStateAtom,
  visibleExercisesAtom,
} from "@/features/workout-log/store/workout-log-atoms";
import {
  patchSeedExercise,
  updateUserExercise,
} from "@/lib/workout-record/model";
import { V2Card, V2Hairline, V2Sheet } from "./primitives";

/**
 * 운동기록 메인 화면용 키패드 시트 오버레이.
 *
 * 지원:
 * - PROGRAM 운동: reps (programEntryStateAtom), weight (draftAtom.seedEditLayer override)
 * - USER 운동: reps + weight (draftAtom.userExercises 직접 patch)
 *
 * 입력값은 모두 메인 폼과 동일 atom store에 write → 양방향 즉시 동기화.
 */
type Field = "weight" | "reps";

export function V2KeypadOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const visibleExercises = useAtomValue(visibleExercisesAtom);
  const [programEntryState, setProgramEntryState] = useAtom(
    programEntryStateAtom,
  );
  const [draft, setDraft] = useAtom(draftAtom);

  // 모든 비삭제 운동 — PROGRAM과 USER 모두 키패드 대상
  const allExercises = useMemo(
    () => visibleExercises.filter((ex) => !ex.deleted),
    [visibleExercises],
  );

  // 첫 활성 운동/세트 자동 결정 (PROGRAM은 빈 reps 슬롯 우선)
  const firstEmptyTarget = useMemo(() => {
    for (const ex of allExercises) {
      if (ex.source === "PROGRAM") {
        const inputs = programEntryState[ex.id]?.repsInputs ?? [];
        for (let i = 0; i < ex.set.repsPerSet.length; i++) {
          const v = (inputs[i] ?? "").trim();
          if (!v) return { exerciseId: ex.id, setIndex: i };
        }
      }
    }
    return allExercises[0]
      ? { exerciseId: allExercises[0].id, setIndex: 0 }
      : null;
  }, [allExercises, programEntryState]);

  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(
    firstEmptyTarget?.exerciseId ?? null,
  );
  const [activeSetIndex, setActiveSetIndex] = useState<number>(
    firstEmptyTarget?.setIndex ?? 0,
  );
  const [activeField, setActiveField] = useState<Field>("reps");

  // 휴식 타이머 — 사용자가 done/next로 set을 마무리하면 자동 시작
  const [restingFrom, setRestingFrom] = useState<number | null>(null);
  const [restElapsed, setRestElapsed] = useState(0);
  useEffect(() => {
    if (restingFrom == null) return;
    const id = window.setInterval(() => {
      setRestElapsed(Math.floor((Date.now() - restingFrom) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [restingFrom]);

  // 시트 열릴 때 active 자동 reset
  useEffect(() => {
    if (!open) return;
    if (firstEmptyTarget) {
      setActiveExerciseId(firstEmptyTarget.exerciseId);
      setActiveSetIndex(firstEmptyTarget.setIndex);
      setActiveField("reps");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeExercise = useMemo(
    () => allExercises.find((ex) => ex.id === activeExerciseId) ?? null,
    [allExercises, activeExerciseId],
  );

  const isUser = activeExercise?.source === "USER";

  // 현재 reps 값 표시
  const repsValue = useMemo(() => {
    if (!activeExercise) return "";
    if (activeExercise.source === "PROGRAM") {
      const inputs = programEntryState[activeExercise.id]?.repsInputs ?? [];
      return (inputs[activeSetIndex] ?? "").trim();
    }
    // USER: set.repsPerSet
    const r = activeExercise.set.repsPerSet[activeSetIndex];
    return r != null && r > 0 ? String(r) : "";
  }, [activeExercise, programEntryState, activeSetIndex]);

  // 현재 weight 값 (운동 단위로 한 개)
  const weightValue = useMemo(() => {
    if (!activeExercise) return "";
    return activeExercise.set.weightKg > 0
      ? String(activeExercise.set.weightKg)
      : "";
  }, [activeExercise]);

  const activeValue = activeField === "reps" ? repsValue : weightValue;

  // ─── reps write ─────────────────────────────────
  const setReps = (next: string) => {
    if (!activeExerciseId || !activeExercise) return;
    if (activeExercise.source === "PROGRAM") {
      setProgramEntryState((prev) => {
        const cur = prev[activeExerciseId];
        if (!cur) return prev;
        const updated = cur.repsInputs.slice();
        updated[activeSetIndex] = next;
        return {
          ...prev,
          [activeExerciseId]: { ...cur, repsInputs: updated },
        };
      });
      return;
    }
    // USER: draft.userExercises[].set.repsPerSet[idx]
    setDraft((prev) => {
      if (!prev) return prev;
      const ex = prev.userExercises.find((e) => e.id === activeExerciseId);
      if (!ex) return prev;
      const repsPerSet = ex.set.repsPerSet.slice();
      const num = next === "" ? 0 : Math.max(0, Math.min(100, Number(next)));
      repsPerSet[activeSetIndex] = Number.isFinite(num) ? num : 0;
      return updateUserExercise(prev, activeExerciseId, {
        set: { repsPerSet, count: repsPerSet.length, reps: repsPerSet[0] ?? 0 },
      });
    });
  };

  // ─── weight write ───────────────────────────────
  const setWeight = (next: string) => {
    if (!activeExerciseId || !activeExercise) return;
    const num =
      next === "" || next === "."
        ? 0
        : Math.max(0, Math.min(9999, Number(next)));
    if (!Number.isFinite(num)) return;

    setDraft((prev) => {
      if (!prev) return prev;
      if (activeExercise.source === "PROGRAM") {
        return patchSeedExercise(prev, activeExerciseId, {
          set: { weightKg: num },
        });
      }
      return updateUserExercise(prev, activeExerciseId, {
        set: { weightKg: num },
      });
    });
  };

  const writeActive = activeField === "reps" ? setReps : setWeight;

  const onKey = (k: string) => {
    if (k === "back") {
      writeActive(activeValue.slice(0, -1));
      return;
    }
    if (k === ".") {
      if (activeField !== "weight") return;
      writeActive(activeValue.includes(".") ? activeValue : activeValue + ".");
      return;
    }
    if (k.startsWith("+") || k.startsWith("-")) {
      const base = activeValue === "" ? 0 : parseFloat(activeValue) || 0;
      const delta = parseFloat(k);
      const next =
        activeField === "weight"
          ? Math.max(0, Math.min(9999, +(base + delta).toFixed(2)))
          : Math.max(0, Math.min(100, Math.round(base + delta)));
      writeActive(String(next));
      return;
    }
    // digit
    if (activeField === "reps" && activeValue.length >= 3) return;
    if (activeField === "weight" && activeValue.length >= 6) return;
    const next = activeValue === "0" ? k : activeValue + k;
    if (activeField === "reps" && Number(next) > 100) return;
    writeActive(next);
  };

  const startRest = () => {
    setRestingFrom(Date.now());
    setRestElapsed(0);
  };
  const stopRest = () => {
    setRestingFrom(null);
    setRestElapsed(0);
  };

  const advance = () => {
    if (!activeExercise || !activeExerciseId) return;
    // weight 활성이면 reps로 전환 (편의)
    if (activeField === "weight") {
      setActiveField("reps");
      return;
    }
    const totalSets = activeExercise.set.repsPerSet.length;
    // 세트 완료 → 휴식 타이머 자동 시작
    startRest();
    if (activeSetIndex < totalSets - 1) {
      setActiveSetIndex(activeSetIndex + 1);
      return;
    }
    // 다음 운동
    const idx = allExercises.findIndex((ex) => ex.id === activeExerciseId);
    for (let i = idx + 1; i < allExercises.length; i++) {
      const next = allExercises[i];
      let firstEmpty = 0;
      if (next.source === "PROGRAM") {
        const inputs = programEntryState[next.id]?.repsInputs ?? [];
        const empty = inputs.findIndex((v) => (v ?? "").trim() === "");
        if (empty >= 0) firstEmpty = empty;
      }
      setActiveExerciseId(next.id);
      setActiveSetIndex(firstEmpty);
      setActiveField("reps");
      return;
    }
    // 모두 완료 — 시트 닫기
    stopRest();
    onClose();
  };

  // 계획 무게 빠른 적용 — PROGRAM의 prescribedWeightKg(있으면) 또는 plannedSetMeta로 reset
  const recommendedWeightKg = useMemo(() => {
    if (!activeExercise) return null;
    if (
      typeof activeExercise.prescribedWeightKg === "number" &&
      activeExercise.prescribedWeightKg > 0
    ) {
      return activeExercise.prescribedWeightKg;
    }
    const target =
      activeExercise.plannedSetMeta?.targetWeightKgPerSet?.[activeSetIndex];
    if (typeof target === "number" && target > 0) return target;
    return null;
  }, [activeExercise, activeSetIndex]);

  const applyRecommendedWeight = () => {
    if (!activeExerciseId || !activeExercise || recommendedWeightKg == null)
      return;
    setDraft((prev) => {
      if (!prev) return prev;
      if (activeExercise.source === "PROGRAM") {
        return patchSeedExercise(prev, activeExerciseId, {
          set: { weightKg: recommendedWeightKg },
        });
      }
      return updateUserExercise(prev, activeExerciseId, {
        set: { weightKg: recommendedWeightKg },
      });
    });
    setActiveField("weight");
  };

  // 진행률
  const completedCount = useMemo(() => {
    let n = 0;
    for (const ex of allExercises) {
      if (ex.source === "PROGRAM") {
        const inputs = programEntryState[ex.id]?.repsInputs ?? [];
        for (let i = 0; i < ex.set.repsPerSet.length; i++) {
          const v = (inputs[i] ?? "").trim();
          if (v && Number.isFinite(Number(v)) && Number(v) > 0) n++;
        }
      } else {
        for (const r of ex.set.repsPerSet) {
          if (r > 0) n++;
        }
      }
    }
    return n;
  }, [allExercises, programEntryState]);

  const totalCount = useMemo(
    () => allExercises.reduce((s, ex) => s + ex.set.repsPerSet.length, 0),
    [allExercises],
  );

  if (allExercises.length === 0 || !draft) {
    return (
      <V2Sheet open={open} onClose={onClose} height="40%" ariaLabel="키패드">
        <div style={{ padding: "24px", textAlign: "center" }}>
          <p className="v2-small" style={{ color: "var(--v2-ink-3)" }}>
            {locale === "ko"
              ? "운동이 없어 키패드를 사용할 수 없습니다."
              : "No exercises to log."}
          </p>
        </div>
      </V2Sheet>
    );
  }

  const plannedReps =
    activeExercise?.set.repsPerSet[activeSetIndex] ?? null;

  return (
    <V2Sheet
      open={open}
      onClose={onClose}
      height="92%"
      ariaLabel={locale === "ko" ? "키패드" : "Keypad"}
    >
      {/* 헤더 */}
      <div style={{ padding: "8px 24px 12px" }}>
        <p className="v2-eyebrow">
          {locale === "ko" ? "키패드" : "KEYPAD"} ·{" "}
          <span style={{ color: "var(--v2-c-success)" }}>
            {completedCount}/{totalCount}
          </span>
        </p>
        <h1 className="v2-h2" style={{ marginTop: 4, fontSize: 18 }}>
          {locale === "ko" ? "빠른 입력" : "Quick entry"}
        </h1>
      </div>

      {/* 운동 picker */}
      <div
        style={{
          padding: "0 16px 8px",
          display: "flex",
          gap: 6,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {allExercises.map((ex) => {
          const isActive = ex.id === activeExerciseId;
          const isUserEx = ex.source === "USER";
          const inputs =
            ex.source === "PROGRAM"
              ? (programEntryState[ex.id]?.repsInputs ?? [])
              : ex.set.repsPerSet.map((r) => (r > 0 ? String(r) : ""));
          const filled = inputs.filter(
            (v) => (v ?? "").toString().trim() !== "" && Number(v) > 0,
          ).length;
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setActiveExerciseId(ex.id);
                const empty = inputs.findIndex(
                  (v) => (v ?? "").toString().trim() === "" || Number(v) <= 0,
                );
                setActiveSetIndex(empty >= 0 ? empty : 0);
                setActiveField("reps");
              }}
              style={{
                flexShrink: 0,
                padding: "10px 14px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                background: isActive ? "var(--v2-ink)" : "var(--v2-paper-2)",
                color: isActive
                  ? "var(--v2-ink-on-accent)"
                  : "var(--v2-ink-2)",
                fontFamily: "var(--v2-f-display)",
                fontWeight: 700,
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                minWidth: 100,
                textAlign: "left",
              }}
            >
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 140,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {ex.exerciseName}
                {isUserEx && (
                  <span
                    style={{
                      fontSize: 8,
                      padding: "1px 4px",
                      borderRadius: 4,
                      background: isActive
                        ? "rgba(255,255,255,0.16)"
                        : "var(--v2-paper-3)",
                      color: isActive
                        ? "var(--v2-ink-on-accent)"
                        : "var(--v2-ink-3)",
                    }}
                  >
                    USER
                  </span>
                )}
              </span>
              <span
                className="v2-mono-label"
                style={{
                  fontSize: 9,
                  opacity: 0.8,
                  color: isActive
                    ? "var(--v2-ink-on-accent)"
                    : "var(--v2-ink-3)",
                }}
              >
                {filled}/{ex.set.repsPerSet.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* 세트 진행 dot */}
      {activeExercise && (
        <div style={{ padding: "0 24px 8px" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {activeExercise.set.repsPerSet.map((_, i) => {
              let filled = false;
              if (activeExercise.source === "PROGRAM") {
                const inputs =
                  programEntryState[activeExercise.id]?.repsInputs ?? [];
                const v = (inputs[i] ?? "").trim();
                filled = !!v && Number(v) > 0;
              } else {
                filled = activeExercise.set.repsPerSet[i] > 0;
              }
              const isCurrent = i === activeSetIndex;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveSetIndex(i)}
                  aria-label={`Set ${i + 1}`}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 9999,
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    background: filled
                      ? "var(--v2-c-success)"
                      : isCurrent
                        ? "var(--v2-accent)"
                        : "var(--v2-paper-3)",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 빅 넘버 디스플레이 — reps + weight 두 행 */}
      <div style={{ padding: "8px 16px 0" }}>
        <V2Card padding="20px">
          <FieldDisplay
            label={locale === "ko" ? "중량" : "Weight"}
            unit="kg"
            value={weightValue || "—"}
            color="var(--v2-c-weight)"
            active={activeField === "weight"}
            onSelect={() => setActiveField("weight")}
            small={false}
          />
          <V2Hairline style={{ marginTop: 14, marginBottom: 14 }} />
          <FieldDisplay
            label={
              locale === "ko"
                ? `반복 · ${locale === "ko" ? "세트" : "Set"} ${activeSetIndex + 1}`
                : `Reps · Set ${activeSetIndex + 1}`
            }
            unit={locale === "ko" ? "회" : "reps"}
            value={repsValue || "—"}
            color="var(--v2-c-reps)"
            active={activeField === "reps"}
            onSelect={() => setActiveField("reps")}
            extra={
              activeExercise?.source === "PROGRAM" &&
              plannedReps != null &&
              plannedReps > 0 ? (
                <span
                  className="v2-mono-label"
                  style={{ marginLeft: "auto", color: "var(--v2-ink-3)" }}
                >
                  {locale === "ko" ? "계획" : "PLAN"} {plannedReps}
                </span>
              ) : null
            }
          />
          {isUser && (
            <p
              className="v2-mono-label"
              style={{
                marginTop: 12,
                color: "var(--v2-ink-3)",
                fontSize: 9,
              }}
            >
              {locale === "ko"
                ? "USER 운동 — 무게는 모든 세트 동일"
                : "USER exercise — same weight across sets"}
            </p>
          )}
        </V2Card>
      </div>

      {/* 휴식 타이머 + 권장값 적용 */}
      <div
        style={{
          padding: "10px 16px 0",
          display: "flex",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        {restingFrom != null ? (
          <V2Card
            tone="accent"
            style={{
              flex: 1,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 20,
                color: "var(--v2-accent-ink)",
              }}
              aria-hidden
            >
              timer
            </span>
            <div style={{ flex: 1 }}>
              <div
                className="v2-label"
                style={{
                  color: "var(--v2-accent-ink)",
                  fontSize: 9,
                }}
              >
                {locale === "ko" ? "휴식" : "REST"}
              </div>
              <div
                className="v2-num-md"
                style={{
                  fontSize: 22,
                  color: "var(--v2-accent-ink)",
                }}
              >
                {String(Math.floor(restElapsed / 60)).padStart(2, "0")}:
                {String(restElapsed % 60).padStart(2, "0")}
              </div>
            </div>
            <button
              type="button"
              onClick={stopRest}
              aria-label={locale === "ko" ? "휴식 중지" : "Stop rest"}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                background: "var(--v2-accent)",
                color: "var(--v2-ink-on-accent)",
                fontFamily: "var(--v2-f-display)",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {locale === "ko" ? "끝" : "Stop"}
            </button>
          </V2Card>
        ) : (
          <button
            type="button"
            onClick={startRest}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 16,
              background: "var(--v2-paper-2)",
              color: "var(--v2-ink-2)",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "var(--v2-f-display)",
              fontWeight: 600,
              fontSize: 13,
              minHeight: 44,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18 }}
              aria-hidden
            >
              timer
            </span>
            {locale === "ko" ? "휴식 시작" : "Start rest"}
          </button>
        )}

        {recommendedWeightKg != null && (
          <button
            type="button"
            onClick={applyRecommendedWeight}
            aria-label={
              locale === "ko"
                ? `권장 무게 ${recommendedWeightKg}kg 적용`
                : `Apply recommended ${recommendedWeightKg}kg`
            }
            style={{
              padding: "12px 14px",
              borderRadius: 16,
              background: "var(--v2-paper-2)",
              color: "var(--v2-ink)",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "var(--v2-f-display)",
              fontWeight: 700,
              fontSize: 13,
              minHeight: 44,
              minWidth: 110,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: "var(--v2-accent)" }}
              aria-hidden
            >
              restart_alt
            </span>
            {recommendedWeightKg}
            <span
              className="v2-mono-label"
              style={{ color: "var(--v2-ink-3)" }}
            >
              kg
            </span>
          </button>
        )}
      </div>

      {/* 키패드 */}
      <div style={{ flex: 1 }} />
      <div
        style={{
          background: "var(--v2-paper-2)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding:
            "14px 12px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          marginTop: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
          }}
        >
          {keysFor(activeField).map((k) => (
            <Key key={k} k={k} onPress={onKey} onAdvance={advance} />
          ))}
        </div>
      </div>
    </V2Sheet>
  );
}

/* ─── 필드 디스플레이 ─────────────────────────────────── */

function FieldDisplay({
  label,
  unit,
  value,
  color,
  active,
  onSelect,
  small,
  extra,
}: {
  label: string;
  unit?: string;
  value: string;
  color: string;
  active: boolean;
  onSelect: () => void;
  small?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 8,
        cursor: "pointer",
        padding: "4px 0",
        opacity: active ? 1 : 0.5,
        background: "transparent",
        border: "none",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span
        className="v2-label"
        style={{ color: active ? color : "var(--v2-ink-3)" }}
      >
        {label}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 8,
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        <span
          className={small ? "v2-num-md" : "v2-num-lg"}
          style={{ color, fontSize: small ? 32 : 48 }}
        >
          {value}
        </span>
        {unit && (
          <span className="v2-h3" style={{ color: "var(--v2-ink-3)" }}>
            {unit}
          </span>
        )}
        {extra}
      </span>
    </button>
  );
}

/* ─── 키패드 키 ─────────────────────────────────── */

function keysFor(field: Field): string[] {
  if (field === "weight") {
    return [
      "7",
      "8",
      "9",
      "+2.5",
      "4",
      "5",
      "6",
      "+5",
      "1",
      "2",
      "3",
      "+10",
      ".",
      "0",
      "back",
      "next",
    ];
  }
  return [
    "7",
    "8",
    "9",
    "+1",
    "4",
    "5",
    "6",
    "-1",
    "1",
    "2",
    "3",
    "+5",
    "0",
    "back",
    "next",
    "done",
  ];
}

function Key({
  k,
  onPress,
  onAdvance,
}: {
  k: string;
  onPress: (k: string) => void;
  onAdvance: () => void;
}) {
  const isOp = k.startsWith("+") || k.startsWith("-");
  const isBack = k === "back";
  const isNext = k === "next";
  const isDone = k === "done";

  const display: CSSProperties = {
    height: 56,
    borderRadius: 14,
    background: isDone
      ? "var(--v2-c-success)"
      : isNext
        ? "var(--v2-accent)"
        : isOp
          ? "var(--v2-accent-weak)"
          : "var(--v2-paper)",
    color:
      isDone || isNext
        ? "var(--v2-ink-on-accent)"
        : isOp
          ? "var(--v2-accent-ink)"
          : "var(--v2-ink)",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--v2-f-num)",
    fontWeight: 700,
    fontSize: isOp ? 16 : 24,
    boxShadow: "var(--v2-elev-1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform var(--v2-d-1) var(--v2-e-out)",
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (isNext || isDone) onAdvance();
        else onPress(k);
      }}
      style={display}
      aria-label={k}
    >
      {isBack ? (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 22 }}
          aria-hidden
        >
          backspace
        </span>
      ) : isNext ? (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 22, color: "var(--v2-ink-on-accent)" }}
          aria-hidden
        >
          arrow_forward
        </span>
      ) : isDone ? (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 22, color: "var(--v2-ink-on-accent)" }}
          aria-hidden
        >
          check
        </span>
      ) : (
        k
      )}
    </button>
  );
}
