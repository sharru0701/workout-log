"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Card, CardActionGroup, CardContent } from "@/components/ui/card";
import { AppTextInput } from "@/components/ui/form-controls";

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

export function ExerciseCatalogContent() {
  const { confirm } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<ExerciseItem[]>([]);
  const loadRequestIdRef = useRef(0);
  const catalogLoadedRef = useRef(false);

  const [query, setQuery] = useState("");
  const [activeLoadQuery, setActiveLoadQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadExercises = useCallback(async (search = "", isSilent = false) => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    try {
      if (!catalogLoadedRef.current && !isSilent) setLoading(true);
      setError(null);
      const normalizedSearch = search.trim().toLowerCase();
      setActiveLoadQuery(normalizedSearch);
      const params = new URLSearchParams({ limit: "200" });
      if (normalizedSearch) {
        params.set("query", normalizedSearch);
      }
      const res = await apiGet<ExerciseResponse>(`/api/exercises?${params.toString()}`);
      if (requestId !== loadRequestIdRef.current) return;
      catalogLoadedRef.current = true;
      setItems(res.items ?? []);
    } catch (e: any) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(e?.message ?? "운동종목 목록을 불러오지 못했습니다.");
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadExercises(query);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadExercises, query]);

  const visibleItems = useMemo(() => items, [items]);
  const listQueryKey = `exercise-catalog:${activeLoadQuery}`;
  const isListSettled = useQuerySettled(listQueryKey, loading);

  return (
    <div>
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

      <section>
        <h2 className="settings-section-title">운동종목 CRUD</h2>
        <Card padding="md" elevated={false}>
          <CardContent>
            <label>
              <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>검색</span>
              <AppTextInput
                variant="compact"
                value={query}
                placeholder="운동종목 검색"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="settings-section-title">추가 (Create)</h2>
        <Card padding="md" elevated={false}>
          <CardContent>
            {!createOpen ? (
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => setCreateOpen(true)}
              >
                운동종목 추가
              </button>
            ) : (
              <>
                <label>
                  <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>운동종목명</span>
                  <AppTextInput
                    variant="compact"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder="예: Incline Bench Press"
                  />
                </label>
                <label>
                  <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>카테고리 (선택)</span>
                  <AppTextInput
                    variant="compact"
                    value={createCategory}
                    onChange={(event) => setCreateCategory(event.target.value)}
                    placeholder="예: Chest"
                  />
                </label>
                <CardActionGroup style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={savingCreate}
                    onClick={() => setCreateOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingCreate || !createName.trim()}
                    onClick={async () => {
                      try {
                        setSavingCreate(true);
                        setNotice(null);
                        const newName = createName.trim();
                        const newCategory = createCategory.trim() || null;
                        
                        // Optimistic UI for Create
                        const tempId = `temp-${Date.now()}`;
                        setItems((prev) => [
                          { id: tempId, name: newName, category: newCategory, aliases: [] },
                          ...prev,
                        ]);
                        setCreateName("");
                        setCreateCategory("");
                        setCreateOpen(false);

                        const res = await apiPost<ExerciseCreateResponse>("/api/exercises", {
                          name: newName,
                          category: newCategory,
                        });
                        setNotice(res.created ? "운동종목이 추가되었습니다." : "이미 존재하는 운동종목입니다.");
                        await loadExercises(query, true);
                      } catch (e: any) {
                        setError(e?.message ?? "운동종목 추가에 실패했습니다.");
                        void loadExercises(query, true); // Rollback
                      } finally {
                        setSavingCreate(false);
                      }
                    }}
                  >
                    {savingCreate ? "추가 중..." : "저장"}
                  </button>
                </CardActionGroup>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="settings-section-title">수정 / 삭제 (Update / Delete)</h2>
        <EmptyStateRows
          when={isListSettled && !error && visibleItems.length === 0}
          label="운동종목이 없습니다"
          description="상단에서 운동종목을 먼저 추가하세요."
        />

        {visibleItems.map((item) => {
          const editingThis = editing?.id === item.id;
          const deletingThis = deletingId === item.id;
          return (
            <Card key={item.id} padding="md" elevated={false} tone={editingThis ? "accent" : "default"}>
              <CardContent>
                {!editingThis ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{item.name}</strong>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                        <button
                          type="button"
                          className="btn btn-icon"
                          aria-label={`${item.name} 수정`}
                          title="운동종목 수정"
                          disabled={deletingThis}
                          onClick={() =>
                            setEditing({
                              id: item.id,
                              name: item.name,
                              category: item.category ?? "",
                            })
                          }
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.05"
                            aria-hidden="true"
                            style={{ width: "22px", height: "22px" }}
                          >
                            <path
                              d="M4.75 19.25h4.1l9.56-9.56a1.75 1.75 0 0 0 0-2.47l-1.63-1.63a1.75 1.75 0 0 0-2.47 0l-9.56 9.56v4.1Z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path d="m13.5 6.5 4 4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-icon-danger"
                          aria-label={deletingThis ? `${item.name} 삭제 중` : `${item.name} 삭제`}
                          title={deletingThis ? "삭제 중..." : "운동종목 삭제"}
                          disabled={deletingThis}
                          onClick={async () => {
                            const confirmDelete = await confirm({
                              title: "운동종목 삭제",
                              message: `'${item.name}' 종목을 삭제하시겠습니까?\n기록에 연결된 exerciseId는 자동 해제됩니다.`,
                              confirmText: "삭제",
                              cancelText: "취소",
                              tone: "danger",
                            });
                            if (!confirmDelete) return;
                            try {
                              setDeletingId(item.id);
                              setNotice(null);

                              // Optimistic UI for Delete
                              setItems((prev) => prev.filter((it) => it.id !== item.id));

                              await apiDelete(`/api/exercises/${encodeURIComponent(item.id)}`);
                              setNotice("운동종목이 삭제되었습니다.");
                              await loadExercises(query, true);
                            } catch (e: any) {
                              setError(e?.message ?? "운동종목 삭제에 실패했습니다.");
                              void loadExercises(query, true); // Rollback
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.1"
                            aria-hidden="true"
                            style={{ width: "22px", height: "22px" }}
                          >
                            <path d="M4.5 7.5h15" strokeLinecap="round" />
                            <path d="M9.75 3.75h4.5" strokeLinecap="round" />
                            <path
                              d="M7.5 7.5v10.5A1.5 1.5 0 0 0 9 19.5h6a1.5 1.5 0 0 0 1.5-1.5V7.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path d="M10.5 10.5v5.25" strokeLinecap="round" />
                            <path d="M13.5 10.5v5.25" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>
                      <span>카테고리: {item.category ?? "미지정"}</span>
                      <span>별칭: {item.aliases.join(", ") || "-"}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <label>
                      <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>운동종목명</span>
                      <AppTextInput
                        variant="compact"
                        value={editing.name}
                        onChange={(event) =>
                          setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                        }
                      />
                    </label>
                    <label>
                      <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>카테고리</span>
                      <AppTextInput
                        variant="compact"
                        value={editing.category}
                        onChange={(event) =>
                          setEditing((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                        }
                      />
                    </label>
                    <CardActionGroup style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={savingEdit || !editing.name.trim()}
                        onClick={async () => {
                          try {
                            setSavingEdit(true);
                            setNotice(null);
                            const targetId = editing.id;
                            const newName = editing.name.trim();
                            const newCategory = editing.category.trim() || null;

                            // Optimistic UI for Update
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === targetId ? { ...it, name: newName, category: newCategory } : it
                              )
                            );
                            setEditing(null);

                            await apiPatch(`/api/exercises/${encodeURIComponent(targetId)}`, {
                              name: newName,
                              category: newCategory,
                            });
                            setNotice("운동종목이 수정되었습니다.");
                            await loadExercises(query, true);
                          } catch (e: any) {
                            setError(e?.message ?? "운동종목 수정에 실패했습니다.");
                            void loadExercises(query, true); // Rollback
                          } finally {
                            setSavingEdit(false);
                          }
                        }}
                      >
                        {savingEdit ? "저장 중..." : "수정 저장"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditing(null)}
                      >
                        취소
                      </button>
                    </CardActionGroup>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
