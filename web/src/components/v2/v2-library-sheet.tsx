"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { apiGet } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { V2Card, V2Sheet } from "./primitives";

type TemplateItem = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  visibility?: string;
  latestVersion?: {
    id: string;
    version: number;
  } | null;
};

type TemplatesResponse = {
  items: TemplateItem[];
  nextCursor?: string | null;
};

type ExerciseItem = {
  id: string;
  name: string;
  category?: string | null;
};

type ExercisesResponse = { items: ExerciseItem[] };

type Tab = "programs" | "exercises";

export function V2LibrarySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const [tab, setTab] = useState<Tab>("programs");
  const [programs, setPrograms] = useState<TemplateItem[] | null>(null);
  const [exercises, setExercises] = useState<ExerciseItem[] | null>(null);
  const [loadingP, setLoadingP] = useState(false);
  const [loadingE, setLoadingE] = useState(false);
  const [errorP, setErrorP] = useState<string | null>(null);
  const [errorE, setErrorE] = useState<string | null>(null);

  // 프로그램 fetch (open 시 1회)
  useEffect(() => {
    if (!open || programs !== null) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingP(true);
        setErrorP(null);
        const res = await apiGet<TemplatesResponse>(
          "/api/templates?limit=10",
          {
            maxAgeMs: 5 * 60_000,
            staleWhileRevalidateMs: 10 * 60_000,
          },
        );
        if (!cancelled) setPrograms(res.items ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setErrorP(
            e?.message ??
              (locale === "ko"
                ? "프로그램을 불러오지 못했습니다."
                : "Failed to load programs."),
          );
          setPrograms([]);
        }
      } finally {
        if (!cancelled) setLoadingP(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, programs, locale]);

  // 운동 fetch (탭 전환 시)
  useEffect(() => {
    if (!open || tab !== "exercises" || exercises !== null) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingE(true);
        setErrorE(null);
        const res = await apiGet<ExercisesResponse>(
          "/api/exercises?limit=20",
          {
            maxAgeMs: 5 * 60_000,
            staleWhileRevalidateMs: 10 * 60_000,
          },
        );
        if (!cancelled) setExercises(res.items ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setErrorE(
            e?.message ??
              (locale === "ko"
                ? "운동을 불러오지 못했습니다."
                : "Failed to load exercises."),
          );
          setExercises([]);
        }
      } finally {
        if (!cancelled) setLoadingE(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, exercises, locale]);

  const sortedExercises = useMemo(
    () =>
      (exercises ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [exercises],
  );

  return (
    <V2Sheet
      open={open}
      onClose={onClose}
      ariaLabel={locale === "ko" ? "라이브러리" : "Library"}
    >
      <div style={{ padding: "8px 24px 12px" }}>
        <p className="v2-eyebrow">
          {locale === "ko" ? "라이브러리" : "LIBRARY"}
        </p>
        <h1 className="v2-h1" style={{ marginTop: 6 }}>
          {locale === "ko" ? "프로그램 · 운동" : "Programs · Exercises"}
        </h1>
      </div>

      {/* 탭 */}
      <div style={{ padding: "0 24px 12px", display: "flex", gap: 6 }}>
        {(
          [
            ["programs", locale === "ko" ? "프로그램" : "Programs"],
            ["exercises", locale === "ko" ? "운동" : "Exercises"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            style={{
              minHeight: 36,
              padding: "8px 14px",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              background: tab === k ? "var(--v2-ink)" : "var(--v2-paper-2)",
              color: tab === k ? "var(--v2-ink-on-accent)" : "var(--v2-ink-2)",
              fontFamily: "var(--v2-f-display)",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div style={{ padding: "4px 16px 16px" }}>
        {tab === "programs" && (
          <>
            {loadingP && programs === null && (
              <V2Card tone="inset">
                <p
                  className="v2-small"
                  style={{ color: "var(--v2-ink-3)", margin: 0 }}
                >
                  {locale === "ko" ? "불러오는 중…" : "Loading…"}
                </p>
              </V2Card>
            )}
            {errorP && (
              <V2Card tone="inset">
                <p
                  className="v2-small"
                  style={{ color: "var(--v2-c-danger)", margin: 0 }}
                >
                  {errorP}
                </p>
              </V2Card>
            )}
            {programs !== null &&
              programs.length === 0 &&
              !loadingP &&
              !errorP && (
                <V2Card tone="inset">
                  <p
                    className="v2-small"
                    style={{ color: "var(--v2-ink-3)", margin: 0 }}
                  >
                    {locale === "ko"
                      ? "표시할 프로그램이 없어요."
                      : "No programs to show."}
                  </p>
                </V2Card>
              )}
            {programs?.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                href={`${APP_ROUTES.programStore}`}
                onClick={onClose}
                style={{ textDecoration: "none", display: "block" }}
              >
                <V2Card style={{ marginBottom: 10 }}>
                  <div className="v2-h2" style={{ fontSize: 18 }}>
                    {p.name}
                  </div>
                  {p.description && (
                    <p
                      className="v2-small"
                      style={{
                        marginTop: 6,
                        color: "var(--v2-ink-2)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.description}
                    </p>
                  )}
                  {p.latestVersion && (
                    <div
                      className="v2-mono-label"
                      style={{ color: "var(--v2-ink-3)", marginTop: 6 }}
                    >
                      v{p.latestVersion.version}
                    </div>
                  )}
                </V2Card>
              </Link>
            ))}
          </>
        )}

        {tab === "exercises" && (
          <>
            {loadingE && exercises === null && (
              <V2Card tone="inset">
                <p
                  className="v2-small"
                  style={{ color: "var(--v2-ink-3)", margin: 0 }}
                >
                  {locale === "ko" ? "불러오는 중…" : "Loading…"}
                </p>
              </V2Card>
            )}
            {errorE && (
              <V2Card tone="inset">
                <p
                  className="v2-small"
                  style={{ color: "var(--v2-c-danger)", margin: 0 }}
                >
                  {errorE}
                </p>
              </V2Card>
            )}
            {sortedExercises.length === 0 && !loadingE && !errorE && (
              <V2Card tone="inset">
                <p
                  className="v2-small"
                  style={{ color: "var(--v2-ink-3)", margin: 0 }}
                >
                  {locale === "ko"
                    ? "표시할 운동이 없어요."
                    : "No exercises to show."}
                </p>
              </V2Card>
            )}
            {sortedExercises.slice(0, 30).map((ex) => (
              <V2Card
                key={ex.id}
                tone="inset"
                style={{ marginBottom: 6, padding: "12px 16px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      className="v2-h3"
                      style={{
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ex.name}
                    </div>
                    {ex.category && (
                      <div
                        className="v2-mono-label"
                        style={{
                          color: "var(--v2-ink-3)",
                          marginTop: 2,
                        }}
                      >
                        {ex.category}
                      </div>
                    )}
                  </div>
                </div>
              </V2Card>
            ))}
          </>
        )}
      </div>

      {/* 액션 */}
      <div style={{ padding: "0 16px 24px", display: "flex", gap: 8 }}>
        {tab === "programs" ? (
          <Link
            href={APP_ROUTES.programStore}
            onClick={onClose}
            style={{ flex: 1, textDecoration: "none" }}
          >
            <button
              type="button"
              style={{
                width: "100%",
                minHeight: 44,
                padding: "10px 18px",
                borderRadius: 12,
                background: "var(--v2-accent)",
                color: "var(--v2-ink-on-accent)",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--v2-f-display)",
                fontWeight: 700,
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
                aria-hidden
              >
                library_books
              </span>
              {locale === "ko" ? "프로그램 스토어" : "Program store"}
            </button>
          </Link>
        ) : (
          <Link
            href="/settings/exercise-management"
            onClick={onClose}
            style={{ flex: 1, textDecoration: "none" }}
          >
            <button
              type="button"
              style={{
                width: "100%",
                minHeight: 44,
                padding: "10px 18px",
                borderRadius: 12,
                background: "var(--v2-accent)",
                color: "var(--v2-ink-on-accent)",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--v2-f-display)",
                fontWeight: 700,
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
                aria-hidden
              >
                fitness_center
              </span>
              {locale === "ko" ? "운동 관리" : "Manage exercises"}
            </button>
          </Link>
        )}
      </div>
    </V2Sheet>
  );
}
