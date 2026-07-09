"use client";

/**
 * v2-session-summary paper(기본 스킨) 본문. 오케스트레이터(V2SessionSummary)가 접어둔
 * SummaryData·라벨을 받아 히어로 + BigStats(goal별) + PR 카드 + 운동별 + 노트 + 액션으로
 * 표현만 담당한다. 로직은 v2-session-summary.model.ts.
 */

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { V2Card, V2Chip, V2PrimaryBtn, V2CountUp } from "./primitives";
import type { ResolvedGoal, SummaryData } from "./v2-session-summary.model";

function formatVolumeShort(kg: number): string {
  if (kg <= 0) return "0";
  if (kg >= 1000) {
    const t = kg / 1000;
    return t % 1 === 0 ? `${t.toFixed(0)}k` : `${t.toFixed(1)}k`;
  }
  return Math.round(kg).toLocaleString();
}

/* ─── BigStat ─── */

function BigStat({
  label,
  value,
  unit,
  color,
  delta,
  sub,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  color?: string;
  delta?: string;
  sub?: string;
}) {
  return (
    <V2Card padding="var(--v2-s-5)">
      <div className="v2-label" style={{ fontSize: "var(--v2-t-eyebrow)" }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--v2-s-1)",
          marginTop: 8,
        }}
      >
        <span
          className="v2-num-md"
          style={{ fontSize: "var(--v2-t-h1)", color: color ?? "var(--v2-ink)" }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="v2-mono-label"
            style={{ color: "var(--v2-ink-3)" }}
          >
            {unit}
          </span>
        )}
      </div>
      {(delta || sub) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--v2-s-1)",
            marginTop: 6,
          }}
        >
          {delta && (
            <span
              className="v2-mono-label"
              style={{ color: "var(--v2-c-success)" }}
            >
              {delta}
            </span>
          )}
          {sub && (
            <span
              className="v2-mono-label"
              style={{ color: "var(--v2-ink-3)" }}
            >
              {sub}
            </span>
          )}
        </div>
      )}
    </V2Card>
  );
}

/* ─── Confetti (단순 SVG) ─── */

function Confetti() {
  const bits = Array.from({ length: 14 });
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        animation: "v2-fade-out 2.4s ease-out 1.6s forwards",
        overflow: "hidden",
      }}
    >
      {bits.map((_, i) => {
        const x = ((i * 37) % 100) + ((i % 5) * 3);
        const delay = (i * 53) % 400;
        const dur = 1400 + ((i * 91) % 800);
        const rot = (i * 37) % 360;
        const colors = [
          "var(--v2-c-pr)",
          "var(--v2-accent)",
          "var(--v2-c-success)",
          "var(--v2-c-volume)",
        ];
        const col = colors[i % colors.length];
        const style: CSSProperties = {
          position: "absolute",
          left: `${x % 100}%`,
          top: 0,
          width: 8,
          height: 14,
          background: col,
          borderRadius: 2,
          animation: `v2-confetti ${dur}ms ${delay}ms cubic-bezier(0.2, 0.8, 0.4, 1) forwards`,
          transform: `rotate(${rot}deg)`,
          opacity: 0,
        };
        return <span key={i} style={style} />;
      })}
    </div>
  );
}

/* ─── paper 본문 ─── */

export function PaperSessionSummaryBody({
  summary,
  notes,
  durationLabel,
  performedAtLabel,
  resolvedGoal,
  heroTitle,
  heroEyebrow,
  freshComplete,
  locale,
}: {
  summary: SummaryData;
  notes: string | null;
  durationLabel: string | null;
  performedAtLabel: string;
  resolvedGoal: ResolvedGoal;
  heroTitle: string;
  heroEyebrow: string;
  freshComplete: boolean;
  locale: "ko" | "en";
}) {
  // PR이 있을 때는 EST 1RM에 강조 표시를 위해 매칭 키 비교
  const topPrMatch =
    summary.topEstOneRm &&
    summary.prKeys.has(summary.topEstOneRm.exerciseName.trim().toLowerCase());

  return (
    <div
      style={{
        padding: "var(--v2-s-2) 0px var(--v2-s-4)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* ── 히어로 ── */}
      <div
        style={{
          padding: "var(--v2-s-5) var(--v2-s-6) var(--v2-s-6)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {freshComplete && <Confetti />}
        <p
          className="v2-eyebrow"
          style={{
            color: freshComplete
              ? "var(--v2-c-pr)"
              : "var(--v2-ink-3)",
            position: "relative",
          }}
        >
          {heroEyebrow}
        </p>
        <h1
          className={freshComplete ? "v2-display" : "v2-h1"}
          style={{
            fontSize: freshComplete ? 56 : 30,
            marginTop: 14,
            position: "relative",
            animation: freshComplete
              ? "v2-rise 600ms cubic-bezier(0.34, 1.6, 0.64, 1) both"
              : undefined,
          }}
        >
          {heroTitle}
        </h1>
        <p
          className="v2-body"
          style={{
            marginTop: 10,
            color: "var(--v2-ink-2)",
            position: "relative",
          }}
        >
          {performedAtLabel}
          {durationLabel && (
            <>
              {" · "}
              <strong style={{ color: "var(--v2-ink)" }}>
                {durationLabel}
              </strong>
            </>
          )}
        </p>
      </div>

      {/* ── BigStats (goal별 차별화) ── */}
      <div
        style={{
          padding: "0px var(--v2-s-4)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--v2-s-2)",
        }}
      >
        {resolvedGoal === "strength" ? (
          <BigStat
            label={locale === "ko" ? "최고 EST 1RM" : "Top EST 1RM"}
            value={
              summary.topEstOneRm
                ? freshComplete
                  ? (
                      <V2CountUp
                        to={summary.topEstOneRm.estOneRm}
                        format={(v) => v.toFixed(1)}
                      />
                    )
                  : summary.topEstOneRm.estOneRm.toFixed(1)
                : "—"
            }
            unit={summary.topEstOneRm ? "kg" : undefined}
            color="var(--v2-c-onerm)"
            sub={
              summary.topEstOneRm
                ? topPrMatch
                  ? `${summary.topEstOneRm.exerciseName} · ${locale === "ko" ? "PR" : "PR"}`
                  : `${summary.topEstOneRm.exerciseName} · ${summary.topEstOneRm.weightKg}kg × ${summary.topEstOneRm.reps}`
                : locale === "ko"
                  ? "기록된 세트 없음"
                  : "No logged sets"
            }
          />
        ) : resolvedGoal === "endurance" ? (
          <BigStat
            label={locale === "ko" ? "시간" : "Duration"}
            value={durationLabel ?? "—"}
            color="var(--v2-c-progress)"
            sub={
              locale === "ko"
                ? `${summary.exerciseSummaries.length}개 운동`
                : `${summary.exerciseSummaries.length} exercises`
            }
          />
        ) : (
          <BigStat
            label={locale === "ko" ? "총 볼륨" : "Volume"}
            value={
              freshComplete ? (
                <V2CountUp
                  to={summary.totalVolume}
                  format={(v) => Math.round(v).toLocaleString()}
                />
              ) : (
                Math.round(summary.totalVolume).toLocaleString()
              )
            }
            unit="kg"
            color="var(--v2-c-volume)"
            sub={
              locale === "ko"
                ? `${summary.totalSets}세트`
                : `${summary.totalSets} sets`
            }
          />
        )}

        {resolvedGoal === "endurance" ? (
          <BigStat
            label={locale === "ko" ? "총 세트" : "Total sets"}
            value={
              freshComplete ? (
                <V2CountUp
                  to={summary.totalSets}
                  format={(v) => Math.round(v).toLocaleString()}
                />
              ) : (
                summary.totalSets.toLocaleString()
              )
            }
            color="var(--v2-c-reps)"
            sub={
              locale === "ko"
                ? `${summary.totalReps.toLocaleString()} reps`
                : `${summary.totalReps.toLocaleString()} reps`
            }
          />
        ) : (
          <BigStat
            label={locale === "ko" ? "시간" : "Duration"}
            value={durationLabel ?? "—"}
            color="var(--v2-ink)"
            sub={
              locale === "ko"
                ? `${summary.exerciseSummaries.length}개 운동`
                : `${summary.exerciseSummaries.length} exercises`
            }
          />
        )}
      </div>

      {/* ── PR 카드 ── */}
      {summary.prCards.length > 0 && (
        <div
          style={{
            padding: "var(--v2-s-3) var(--v2-s-4) 0px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--v2-s-2)",
          }}
        >
          {summary.prCards.map((p) => {
            const isPersonal = p.source === "personal";
            const eyebrow = isPersonal
              ? locale === "ko"
                ? "새 PR"
                : "NEW PR"
              : locale === "ko"
                ? "증량 성공"
                : "PROGRESSED";
            return (
              <V2Card
                key={`${p.source}:${p.target}`}
                padding="var(--v2-s-5)"
                style={{
                  background:
                    "color-mix(in srgb, var(--v2-c-pr) 12%, var(--v2-paper))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--v2-s-3)",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "var(--v2-t-h1)",
                      color: "var(--v2-c-pr)",
                      fontVariationSettings: "'FILL' 1, 'wght' 600",
                    }}
                    aria-hidden
                  >
                    workspace_premium
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="v2-label"
                      style={{ color: "var(--v2-c-pr)", fontSize: "var(--v2-t-eyebrow)" }}
                    >
                      {eyebrow}
                    </div>
                    <div
                      className="v2-h2"
                      style={{
                        fontSize: "var(--v2-t-20)",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.target} ·{" "}
                      <span style={{ color: "var(--v2-c-pr)" }}>
                        {p.afterWorkKg.toFixed(1)} kg
                      </span>
                    </div>
                    <div
                      className="v2-mono-label"
                      style={{ color: "var(--v2-ink-3)", marginTop: 4 }}
                    >
                      {isPersonal ? (
                        <>
                          EST 1RM{" "}
                          {(p.estOneRm ?? 0).toFixed(1)}
                          {p.deltaKg > 0
                            ? ` · +${p.deltaKg.toFixed(1)} ${locale === "ko" ? "kg 갱신" : "kg over best"}`
                            : ""}
                        </>
                      ) : p.beforeWorkKg != null ? (
                        `${p.beforeWorkKg.toFixed(1)} → ${p.afterWorkKg.toFixed(1)} (+${p.deltaKg.toFixed(1)})${
                          (p.estOneRm ?? 0) > 0
                            ? ` · EST 1RM ${(p.estOneRm ?? 0).toFixed(1)}`
                            : ""
                        }`
                      ) : (
                        `+${p.deltaKg.toFixed(1)}kg${
                          (p.estOneRm ?? 0) > 0
                            ? ` · EST 1RM ${(p.estOneRm ?? 0).toFixed(1)}`
                            : ""
                        }`
                      )}
                    </div>
                  </div>
                </div>
              </V2Card>
            );
          })}
        </div>
      )}

      {/* ── 운동별 요약 ── */}
      {summary.exerciseSummaries.length > 0 && (
        <>
          <div style={{ padding: "var(--v2-s-6) var(--v2-s-6) var(--v2-s-2)" }}>
            <div className="v2-label">
              {locale === "ko" ? "운동별" : "By exercise"}
            </div>
          </div>
          <div style={{ padding: "0px var(--v2-s-4)" }}>
            {summary.exerciseSummaries.map((ex, i) => {
              const isPr = summary.prKeys.has(
                ex.name.trim().toLowerCase(),
              );
              return (
                <V2Card
                  key={`${ex.name}-${i}`}
                  tone="paper"
                  style={{ marginBottom: 6, padding: "var(--v2-s-4) var(--v2-s-4)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--v2-s-3)",
                    }}
                  >
                    <div
                      className="v2-font-num"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--v2-r-1)",
                        background: isPr
                          ? "color-mix(in srgb, var(--v2-c-pr) 16%, var(--v2-paper))"
                          : "var(--v2-paper-2)",
                        color: isPr
                          ? "var(--v2-c-pr)"
                          : "var(--v2-ink-3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "var(--v2-t-12)",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--v2-s-1)",
                        }}
                      >
                        <span
                          className="v2-h3"
                          style={{
                            fontSize: "var(--v2-t-14)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          {ex.name}
                        </span>
                        {isPr && <V2Chip tone="pr">PR</V2Chip>}
                      </div>
                      <div
                        className="v2-mono-label"
                        style={{
                          color: "var(--v2-ink-3)",
                          marginTop: 2,
                        }}
                      >
                        {resolvedGoal === "strength" ? (
                          <>
                            {ex.setCount}
                            {locale === "ko" ? "세트" : " sets"}
                            {ex.volumeKg > 0
                              ? ` · ${formatVolumeShort(ex.volumeKg)}kg`
                              : ""}
                          </>
                        ) : resolvedGoal === "endurance" ? (
                          <>
                            {ex.setCount}
                            {locale === "ko" ? "세트" : " sets"}
                            {ex.topWeightKg > 0
                              ? ` · ${ex.topWeightKg.toLocaleString()}kg${ex.topWeightSuffix ? ` ${ex.topWeightSuffix}` : ""}`
                              : ""}
                          </>
                        ) : (
                          <>
                            {ex.setCount}
                            {locale === "ko" ? "세트" : " sets"}
                            {ex.topWeightKg > 0
                              ? ` · top ${ex.topWeightKg.toLocaleString()}kg${ex.topWeightSuffix ? ` ${ex.topWeightSuffix}` : ""}`
                              : ""}
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {resolvedGoal === "strength" ? (
                        <>
                          <div
                            className="v2-num-sm"
                            style={{ color: "var(--v2-c-weight)" }}
                          >
                            {ex.topWeightKg > 0
                              ? ex.topWeightKg.toLocaleString()
                              : "—"}
                          </div>
                          <div
                            className="v2-mono-label"
                            style={{
                              fontSize: "var(--v2-t-eyebrow)",
                              color: "var(--v2-ink-3)",
                              marginTop: 2,
                            }}
                          >
                            {locale === "ko" ? "top kg" : "top kg"}
                          </div>
                        </>
                      ) : resolvedGoal === "endurance" ? (
                        <>
                          <div
                            className="v2-num-sm"
                            style={{ color: "var(--v2-c-reps)" }}
                          >
                            {ex.totalReps.toLocaleString()}
                          </div>
                          <div
                            className="v2-mono-label"
                            style={{
                              fontSize: "var(--v2-t-eyebrow)",
                              color: "var(--v2-ink-3)",
                              marginTop: 2,
                            }}
                          >
                            reps
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className="v2-num-sm"
                            style={{ color: "var(--v2-c-volume)" }}
                          >
                            {formatVolumeShort(ex.volumeKg)}
                          </div>
                          <div
                            className="v2-mono-label"
                            style={{
                              fontSize: "var(--v2-t-eyebrow)",
                              color: "var(--v2-ink-3)",
                              marginTop: 2,
                            }}
                          >
                            kg
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </V2Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── 노트 ── */}
      {notes && notes.trim().length > 0 && (
        <div style={{ padding: "var(--v2-s-4) var(--v2-s-4) 0px" }}>
          <V2Card>
            <div className="v2-label">
              {locale === "ko" ? "노트" : "Notes"}
            </div>
            <p
              className="v2-body"
              style={{ marginTop: 10, whiteSpace: "pre-wrap" }}
            >
              {notes}
            </p>
          </V2Card>
        </div>
      )}

      {/* ── 액션 ── */}
      <div
        style={{
          padding: "var(--v2-s-5) var(--v2-s-4) var(--v2-s-2)",
          display: "flex",
          gap: "var(--v2-s-2)",
        }}
      >
        <Link
          href="/"
          style={{ flex: 2, textDecoration: "none" }}
        >
          <V2PrimaryBtn full icon="check">
            {locale === "ko" ? "홈으로" : "Home"}
          </V2PrimaryBtn>
        </Link>
      </div>
    </div>
  );
}
