"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";

type ExerciseItem = {
  id: string;
  name: string;
  category: string | null;
  aliases: string[];
};

type ExerciseResponse = {
  items: ExerciseItem[];
};

type ExerciseCreateResponse = {
  exercise: {
    id: string;
    name: string;
    category: string | null;
  } | null;
  created: boolean;
};

type EditingState = {
  id: string;
  name: string;
  category: string;
};

export default function ExerciseCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<ExerciseItem[]>([]);

  const [query, setQuery] = useState("");
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadExercises = useCallback(async (search = "") => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "200" });
      if (search.trim()) {
        params.set("query", search.trim());
      }
      const res = await apiGet<ExerciseResponse>(`/api/exercises?${params.toString()}`);
      setItems(res.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "운동종목 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExercises("");
  }, [loadExercises]);

  const visibleItems = useMemo(() => items, [items]);

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={120}
        label="운동종목 목록 로딩 중"
        description="DB 저장 종목을 조회하고 있습니다."
      />
      <ErrorStateRows
        message={error}
        title="운동종목 목록 조회 실패"
        onRetry={() => {
          void loadExercises(query);
        }}
      />
      <NoticeStateRows message={notice} label="안내" />

      <section className="grid gap-2">
        <h2 className="ios-section-heading">운동종목 CRUD</h2>
        <article className="motion-card rounded-2xl border p-4 grid gap-2">
          <label className="grid gap-1">
            <span className="ui-card-label">검색</span>
            <input
              className="workout-set-input workout-set-input-text"
              value={query}
              placeholder="운동종목 검색"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold"
            onClick={() => {
              void loadExercises(query);
            }}
          >
            검색
          </button>
        </article>
      </section>

      <section className="grid gap-2">
        <h2 className="ios-section-heading">추가 (Create)</h2>
        <article className="motion-card rounded-2xl border p-4 grid gap-2">
          <label className="grid gap-1">
            <span className="ui-card-label">운동종목명</span>
            <input
              className="workout-set-input workout-set-input-text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="예: Incline Bench Press"
            />
          </label>
          <label className="grid gap-1">
            <span className="ui-card-label">카테고리 (선택)</span>
            <input
              className="workout-set-input workout-set-input-text"
              value={createCategory}
              onChange={(event) => setCreateCategory(event.target.value)}
              placeholder="예: Chest"
            />
          </label>
          <button
            type="button"
            className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold"
            disabled={savingCreate || !createName.trim()}
            onClick={async () => {
              try {
                setSavingCreate(true);
                setNotice(null);
                const res = await apiPost<ExerciseCreateResponse>("/api/exercises", {
                  name: createName.trim(),
                  category: createCategory.trim() || null,
                });
                setCreateName("");
                setCreateCategory("");
                setNotice(res.created ? "운동종목이 추가되었습니다." : "이미 존재하는 운동종목입니다.");
                await loadExercises(query);
              } catch (e: any) {
                setError(e?.message ?? "운동종목 추가에 실패했습니다.");
              } finally {
                setSavingCreate(false);
              }
            }}
          >
            {savingCreate ? "추가 중..." : "운동종목 추가"}
          </button>
        </article>
      </section>

      <section className="grid gap-2">
        <h2 className="ios-section-heading">수정 / 삭제 (Update / Delete)</h2>
        <EmptyStateRows
          when={!loading && !error && visibleItems.length === 0}
          label="운동종목이 없습니다"
          description="상단에서 운동종목을 먼저 추가하세요."
        />

        {visibleItems.map((item) => {
          const editingThis = editing?.id === item.id;
          return (
            <article key={item.id} className="motion-card rounded-2xl border p-4 grid gap-2">
              {!editingThis ? (
                <>
                  <div className="grid gap-1 text-sm">
                    <strong>{item.name}</strong>
                    <span className="text-[var(--text-secondary)]">카테고리: {item.category ?? "미지정"}</span>
                    <span className="text-[var(--text-secondary)]">별칭: {item.aliases.join(", ") || "-"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold"
                      onClick={() =>
                        setEditing({
                          id: item.id,
                          name: item.name,
                          category: item.category ?? "",
                        })
                      }
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold text-[var(--color-danger)]"
                      disabled={deletingId === item.id}
                      onClick={async () => {
                        const confirmDelete = window.confirm(
                          `'${item.name}' 종목을 삭제하시겠습니까?\n기록에 연결된 exerciseId는 자동 해제됩니다.`,
                        );
                        if (!confirmDelete) return;
                        try {
                          setDeletingId(item.id);
                          setNotice(null);
                          const res = await fetch(`/api/exercises/${encodeURIComponent(item.id)}`, {
                            method: "DELETE",
                          });
                          if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            throw new Error(body?.error ?? `삭제 실패: ${res.status}`);
                          }
                          setNotice("운동종목이 삭제되었습니다.");
                          await loadExercises(query);
                        } catch (e: any) {
                          setError(e?.message ?? "운동종목 삭제에 실패했습니다.");
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                    >
                      {deletingId === item.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="grid gap-1">
                    <span className="ui-card-label">운동종목명</span>
                    <input
                      className="workout-set-input workout-set-input-text"
                      value={editing.name}
                      onChange={(event) =>
                        setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="ui-card-label">카테고리</span>
                    <input
                      className="workout-set-input workout-set-input-text"
                      value={editing.category}
                      onChange={(event) =>
                        setEditing((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                      }
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold"
                      disabled={savingEdit || !editing.name.trim()}
                      onClick={async () => {
                        try {
                          setSavingEdit(true);
                          setNotice(null);
                          const res = await fetch(`/api/exercises/${encodeURIComponent(editing.id)}`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              name: editing.name.trim(),
                              category: editing.category.trim() || null,
                            }),
                          });
                          if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            throw new Error(body?.error ?? `수정 실패: ${res.status}`);
                          }
                          setEditing(null);
                          setNotice("운동종목이 수정되었습니다.");
                          await loadExercises(query);
                        } catch (e: any) {
                          setError(e?.message ?? "운동종목 수정에 실패했습니다.");
                        } finally {
                          setSavingEdit(false);
                        }
                      }}
                    >
                      {savingEdit ? "저장 중..." : "수정 저장"}
                    </button>
                    <button
                      type="button"
                      className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold"
                      onClick={() => setEditing(null)}
                    >
                      취소
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
