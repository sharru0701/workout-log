"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { apiPost } from "@/lib/api";
import {
  V2Card,
  V2Hairline,
  V2IconBtn,
  V2PrimaryBtn,
  V2FieldRow,
  V2CountUp,
} from "./primitives";

/* ─── types ─── */

type Field = "weight" | "reps" | "rpe";

type DraftSet = {
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
};

type CompletedSet = {
  weightKg: number;
  reps: number;
  rpe: number | null;
};

const PLATE_DENOMS = [25, 20, 15, 10, 5, 2.5, 1.25];

function computePlates(weightKg: number): number[] {
  const perSide = Math.max(0, (weightKg - 20) / 2);
  let rem = perSide;
  const used: number[] = [];
  for (const p of PLATE_DENOMS) {
    while (rem >= p - 0.001) {
      used.push(p);
      rem = +(rem - p).toFixed(2);
    }
  }
  return used;
}

function plateColor(p: number): string {
  return (
    {
      25: "#b13a2c",
      20: "#3068a3",
      15: "#9a6b00",
      10: "#2f7d6e",
      5: "#5a5751",
      2.5: "#5a5751",
      1.25: "#8b8478",
    } as Record<number, string>
  )[p] ?? "#5a5751";
}

/* ─── 메인 ─── */

export function V2KeypadQuickLog() {
  const router = useRouter();
  const { locale } = useLocale();

  const [exerciseName, setExerciseName] = useState("");
  const [draft, setDraft] = useState<DraftSet>({
    weightKg: null,
    reps: null,
    rpe: null,
  });
  const [completed, setCompleted] = useState<CompletedSet[]>([]);
  const [field, setField] = useState<Field>("weight");
  const [restingFrom, setRestingFrom] = useState<number | null>(null);
  const [rest, setRest] = useState(0);
  const [pr, setPr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sessionStartRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // 휴식 타이머
  useEffect(() => {
    if (restingFrom == null) return;
    const id = window.setInterval(() => {
      setRest(Math.floor((Date.now() - restingFrom) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [restingFrom]);

  // 전체 경과
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const valueOf = (f: Field): string => {
    const v =
      f === "weight" ? draft.weightKg : f === "reps" ? draft.reps : draft.rpe;
    return v == null ? "—" : String(v);
  };

  const setDraftField = (f: Field, next: string) => {
    const num = next === "" ? null : Number(next);
    const safe = num != null && Number.isFinite(num) ? num : null;
    setDraft((prev) => {
      if (f === "weight") return { ...prev, weightKg: safe };
      if (f === "reps") return { ...prev, reps: safe };
      return { ...prev, rpe: safe };
    });
  };

  const onKey = (k: string) => {
    if (k === "back") {
      const cur = valueOf(field);
      setDraftField(field, cur === "—" ? "" : cur.slice(0, -1));
      return;
    }
    if (k === ".") {
      const cur = valueOf(field);
      setDraftField(
        field,
        cur === "—" ? "0." : cur.includes(".") ? cur : cur + ".",
      );
      return;
    }
    if (k.startsWith("+")) {
      const cur = valueOf(field);
      const base = cur === "—" ? 0 : parseFloat(cur);
      const delta = parseFloat(k.slice(1));
      setDraftField(field, String(+(base + delta).toFixed(2)));
      return;
    }
    const cur = valueOf(field);
    setDraftField(field, cur === "—" || cur === "0" ? k : cur + k);
  };

  const canCompleteSet =
    draft.weightKg != null &&
    draft.weightKg > 0 &&
    draft.reps != null &&
    draft.reps > 0;

  const completeSet = () => {
    if (!canCompleteSet) return;
    const newSet: CompletedSet = {
      weightKg: draft.weightKg!,
      reps: draft.reps!,
      rpe: draft.rpe,
    };
    setCompleted((prev) => [...prev, newSet]);
    setRestingFrom(Date.now());
    setRest(0);

    // PR 데모: 이번 세트가 누적 중 가장 무거우면 빛
    const prevTop = completed.reduce(
      (m, s) => (s.weightKg > m ? s.weightKg : m),
      0,
    );
    if (newSet.weightKg > prevTop && newSet.weightKg >= 60) {
      const est = newSet.weightKg * (1 + newSet.reps / 30);
      setPr(est);
      window.setTimeout(() => setPr(null), 2400);
    }

    // 다음 세트는 같은 무게/반복 prefill
    setField("weight");
  };

  const dismissRest = () => {
    setRestingFrom(null);
    setRest(0);
  };

  const removeSet = (index: number) => {
    setCompleted((prev) => prev.filter((_, i) => i !== index));
  };

  const saveSession = async () => {
    if (saving) return;
    if (completed.length === 0) {
      setSaveError(
        locale === "ko"
          ? "최소 한 세트는 완료해 주세요."
          : "Complete at least one set.",
      );
      return;
    }
    const trimmedName = exerciseName.trim();
    if (!trimmedName) {
      setSaveError(
        locale === "ko" ? "운동명을 입력해 주세요." : "Enter an exercise name.",
      );
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const performedAt = new Date(sessionStartRef.current).toISOString();
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));

      const payload = {
        performedAt,
        timezone: tz,
        durationMinutes,
        sets: completed.map((s, i) => ({
          exerciseName: trimmedName,
          sortOrder: i,
          setNumber: i + 1,
          reps: s.reps,
          weightKg: s.weightKg,
          rpe: s.rpe,
          isExtra: false,
        })),
      };

      const res = await apiPost<{ log?: { id?: string } }>(
        "/api/logs",
        payload,
      );
      const savedId = res?.log?.id;
      if (savedId) {
        router.replace(
          `/workout/session/${encodeURIComponent(savedId)}?fresh=1`,
        );
      } else {
        router.replace("/");
      }
    } catch (e: any) {
      setSaveError(
        e?.message ??
          (locale === "ko" ? "저장에 실패했습니다." : "Failed to save."),
      );
    } finally {
      setSaving(false);
    }
  };

  const est =
    draft.weightKg != null && draft.reps != null && draft.reps > 0
      ? (draft.weightKg * (1 + draft.reps / 30)).toFixed(1)
      : "—";

  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  const totalVolume = useMemo(
    () => completed.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
    [completed],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "var(--v2-bg)",
        color: "var(--v2-ink)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 상단 */}
      <div
        style={{
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <V2IconBtn
          icon="close"
          onClick={() => router.back()}
          size={40}
          label={locale === "ko" ? "닫기" : "Close"}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="v2-eyebrow"
            style={{ color: "var(--v2-ink-3)" }}
          >
            {locale === "ko" ? `진행 중 · ${elapsedLabel}` : `ACTIVE · ${elapsedLabel}`}
          </p>
          <input
            type="text"
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            placeholder={
              locale === "ko" ? "운동명 (예: 백스쿼트)" : "Exercise (e.g. Back Squat)"
            }
            style={{
              width: "100%",
              marginTop: 2,
              border: "none",
              background: "transparent",
              outline: "none",
              fontFamily: "var(--v2-f-display)",
              fontWeight: 600,
              fontSize: 16,
              color: "var(--v2-ink)",
              padding: 0,
            }}
          />
        </div>
        <button
          type="button"
          onClick={saveSession}
          disabled={saving || completed.length === 0}
          style={{
            padding: "8px 14px",
            borderRadius: 12,
            border: "none",
            background:
              completed.length > 0
                ? "var(--v2-c-success)"
                : "var(--v2-paper-2)",
            color:
              completed.length > 0
                ? "var(--v2-ink-on-accent)"
                : "var(--v2-ink-3)",
            fontFamily: "var(--v2-f-display)",
            fontWeight: 700,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: saving || completed.length === 0 ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving
            ? locale === "ko"
              ? "저장 중"
              : "Saving"
            : locale === "ko"
              ? "완료"
              : "Done"}
        </button>
      </div>

      {/* 진행 표시 + 완료 세트 요약 */}
      <div style={{ padding: "0 24px 8px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div className="v2-label">
            {locale === "ko"
              ? `세트 ${completed.length + 1}`
              : `SET ${completed.length + 1}`}
            {completed.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  color: "var(--v2-ink-3)",
                  fontSize: 10,
                }}
              >
                · {locale === "ko" ? "총" : "TOTAL"}{" "}
                {Math.round(totalVolume).toLocaleString()}kg
              </span>
            )}
          </div>
          {completed.length > 0 && (
            <span
              className="v2-mono-label"
              style={{ color: "var(--v2-c-success)" }}
            >
              {completed.length}{" "}
              {locale === "ko" ? "세트 완료" : "done"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {Array.from({ length: Math.max(5, completed.length + 1) }).map(
            (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 9999,
                  background:
                    i < completed.length
                      ? "var(--v2-c-success)"
                      : i === completed.length
                        ? "var(--v2-accent)"
                        : "var(--v2-paper-3)",
                }}
              />
            ),
          )}
        </div>
      </div>

      {/* 빅 넘버 디스플레이 + 완료 세트 리스트 */}
      <div
        style={{
          padding: "20px 24px 8px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            background: "var(--v2-paper)",
            borderRadius: 24,
            padding: "24px 24px 20px",
            boxShadow: "var(--v2-elev-1)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <V2FieldRow
            label={locale === "ko" ? "중량" : "Weight"}
            unit="kg"
            value={valueOf("weight")}
            color="var(--v2-c-weight)"
            active={field === "weight"}
            onSelect={() => setField("weight")}
          />
          <V2Hairline />
          <V2FieldRow
            label={locale === "ko" ? "반복" : "Reps"}
            unit={locale === "ko" ? "회" : ""}
            value={valueOf("reps")}
            color="var(--v2-c-reps)"
            active={field === "reps"}
            onSelect={() => setField("reps")}
          />
          <V2Hairline />
          <V2FieldRow
            label="RPE"
            value={valueOf("rpe")}
            color="var(--v2-ink-2)"
            active={field === "rpe"}
            onSelect={() => setField("rpe")}
            small
          />
        </div>

        {/* 추정 1RM + 플레이트 */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <V2Card tone="inset" style={{ padding: "12px 16px" }}>
            <div className="v2-label" style={{ fontSize: 9 }}>
              EST. 1RM
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                marginTop: 4,
              }}
            >
              <span
                className="v2-num-md"
                style={{ fontSize: 22, color: "var(--v2-c-onerm)" }}
              >
                {est}
              </span>
              <span
                className="v2-mono-label"
                style={{ color: "var(--v2-ink-3)" }}
              >
                kg
              </span>
            </div>
          </V2Card>
          <V2Card tone="inset" style={{ padding: "12px 16px" }}>
            <div className="v2-label" style={{ fontSize: 9 }}>
              {locale === "ko" ? "플레이트 (각 사이드)" : "PLATES (each side)"}
            </div>
            <PlateRow weightKg={draft.weightKg ?? 0} />
          </V2Card>
        </div>

        {/* 휴식 / 완료 */}
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          {restingFrom != null ? (
            <V2Card
              tone="accent"
              style={{
                flex: 1,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 22, color: "var(--v2-accent-ink)" }}
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
                  style={{ fontSize: 24, color: "var(--v2-accent-ink)" }}
                >
                  {String(Math.floor(rest / 60)).padStart(2, "0")}:
                  {String(rest % 60).padStart(2, "0")}
                </div>
              </div>
              <button
                type="button"
                onClick={dismissRest}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--v2-accent)",
                  color: "var(--v2-ink-on-accent)",
                  fontFamily: "var(--v2-f-display)",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {locale === "ko" ? "다음" : "NEXT"}
              </button>
            </V2Card>
          ) : (
            <V2PrimaryBtn
              full
              icon="check"
              onClick={completeSet}
              disabled={!canCompleteSet}
            >
              {locale === "ko" ? "이 세트 완료" : "Complete set"}
            </V2PrimaryBtn>
          )}
        </div>

        {/* 완료된 세트 리스트 */}
        {completed.length > 0 && (
          <V2Card
            tone="inset"
            style={{ marginTop: 12, padding: "12px 16px" }}
          >
            <div className="v2-label" style={{ fontSize: 9 }}>
              {locale === "ko" ? "완료된 세트" : "Completed sets"}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 8,
              }}
            >
              {completed.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 0",
                    borderBottom:
                      i < completed.length - 1
                        ? "1px solid var(--v2-hairline)"
                        : "none",
                  }}
                >
                  <span
                    className="v2-mono-label"
                    style={{
                      width: 20,
                      color: "var(--v2-ink-3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="v2-num-sm"
                    style={{ color: "var(--v2-c-weight)" }}
                  >
                    {s.weightKg}
                  </span>
                  <span
                    className="v2-mono-label"
                    style={{ color: "var(--v2-ink-3)" }}
                  >
                    kg ×
                  </span>
                  <span
                    className="v2-num-sm"
                    style={{ color: "var(--v2-c-reps)" }}
                  >
                    {s.reps}
                  </span>
                  {s.rpe != null && (
                    <span
                      className="v2-mono-label"
                      style={{ color: "var(--v2-c-pr)" }}
                    >
                      RPE {s.rpe}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => removeSet(i)}
                    aria-label={
                      locale === "ko" ? "세트 삭제" : "Delete set"
                    }
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "var(--v2-ink-3)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 18 }}
                      aria-hidden
                    >
                      close
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </V2Card>
        )}

        {saveError && (
          <V2Card
            tone="inset"
            style={{
              marginTop: 10,
              padding: "10px 14px",
              background:
                "color-mix(in srgb, var(--v2-c-danger) 14%, var(--v2-paper))",
            }}
          >
            <p
              className="v2-small"
              style={{ color: "var(--v2-c-danger)", margin: 0 }}
            >
              {saveError}
            </p>
          </V2Card>
        )}
      </div>

      {/* 키패드 */}
      <div
        style={{
          background: "var(--v2-paper-2)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding:
            "14px 12px calc(env(safe-area-inset-bottom, 0px) + 24px)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
          }}
        >
          {KEYS.map((k) => (
            <Key key={k} k={k} onPress={onKey} onSave={completeSet} />
          ))}
        </div>
      </div>

      {/* PR 모먼트 */}
      {pr !== null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 91,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--v2-c-pr) 14%, transparent)",
            animation: "v2-pr-flash 2.2s ease-out forwards",
          }}
        >
          <div
            style={{
              background: "var(--v2-paper)",
              borderRadius: 28,
              padding: "28px 36px",
              boxShadow: "var(--v2-elev-3)",
              textAlign: "center",
              animation:
                "v2-pr-pop 600ms cubic-bezier(0.34, 1.6, 0.64, 1) forwards",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 56,
                color: "var(--v2-c-pr)",
                fontVariationSettings: "'FILL' 1, 'wght' 600",
              }}
              aria-hidden
            >
              workspace_premium
            </span>
            <div
              className="v2-h1"
              style={{ marginTop: 8, color: "var(--v2-c-pr)" }}
            >
              {locale === "ko" ? "이 세션 최고!" : "Session best!"}
            </div>
            <div className="v2-small" style={{ marginTop: 4 }}>
              EST 1RM <V2CountUp to={pr} format={(v) => v.toFixed(1)} /> kg
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 키패드 키 ─── */

const KEYS = [
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
  "save",
];

function Key({
  k,
  onPress,
  onSave,
}: {
  k: string;
  onPress: (k: string) => void;
  onSave: () => void;
}) {
  const isOp = k.startsWith("+");
  const isBack = k === "back";
  const isSave = k === "save";

  const display: CSSProperties = {
    height: 56,
    borderRadius: 14,
    background: isSave
      ? "var(--v2-accent)"
      : isOp
        ? "var(--v2-accent-weak)"
        : "var(--v2-paper)",
    color: isSave
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
      onClick={() => (isSave ? onSave() : onPress(k))}
      style={display}
      aria-label={isBack ? "backspace" : isSave ? "save" : k}
    >
      {isBack ? (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 22 }}
          aria-hidden
        >
          backspace
        </span>
      ) : isSave ? (
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 22,
            color: "var(--v2-ink-on-accent)",
          }}
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

/* ─── 플레이트 시각화 ─── */

function PlateRow({ weightKg }: { weightKg: number }) {
  const used = computePlates(weightKg);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        marginTop: 8,
        flexWrap: "wrap",
      }}
    >
      {used.length === 0 ? (
        <span
          className="v2-mono-label"
          style={{ color: "var(--v2-ink-3)" }}
        >
          BAR ONLY
        </span>
      ) : (
        used.map((p, i) => (
          <div
            key={i}
            style={{
              width: 6 + p * 0.6,
              height: 22 + p * 0.4,
              borderRadius: 2,
              background: plateColor(p),
            }}
            title={`${p}kg`}
          />
        ))
      )}
      <span
        className="v2-mono-label"
        style={{ color: "var(--v2-ink-3)", marginLeft: 6 }}
      >
        ×{used.length}
      </span>
    </div>
  );
}
