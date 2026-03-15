"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Card, CardActionGroup, CardContent } from "@/components/ui/card";

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

  const [query, setQuery] = useState("");
  const [activeLoadQuery, setActiveLoadQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadExercises = useCallback(async (search = "") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    try {
      setLoading(true);
      setError(null);
      const normalizedSearch = search.trim().toLowerCase();
      setActiveLoadQuery(normalizedSearch);
      const params = new URLSearchParams({ limit: "200" });
      if (normalizedSearch) {
        params.set("query", normalizedSearch);
      }
      const res = await apiGet<ExerciseResponse>(`/api/exercises?${params.toString()}`);
      if (requestId !== loadRequestIdRef.current) return;
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
  const circleActionButtonStyle = {
    width: "var(--touch-target)",
    height: "var(--touch-target)",
    minWidth: "var(--touch-target)",
    minHeight: "var(--touch-target)",
    padding: 0,
    aspectRatio: "1 / 1",
  } as const;

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
        <h2>운동종목 CRUD</h2>
        <Card padding="md" elevated={false}>
          <CardContent>
            <label>
              <span>검색</span>
              <input
                value={query}
                placeholder="운동종목 검색"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2>추가 (Create)</h2>
        <Card padding="md" elevated={false}>
          <CardContent>
            {!createOpen ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
              >
                운동종목 추가
              </button>
            ) : (
              <>
                <label>
                  <span>운동종목명</span>
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder="예: Incline Bench Press"
                  />
                </label>
                <label>
                  <span>카테고리 (선택)</span>
                  <input
                    value={createCategory}
                    onChange={(event) => setCreateCategory(event.target.value)}
                    placeholder="예: Chest"
                  />
                </label>
                <CardActionGroup>
                  <button
                    type="button"
                    disabled={savingCreate}
                    onClick={() => setCreateOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
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
                        setCreateOpen(false);
                        setNotice(res.created ? "운동종목이 추가되었습니다." : "이미 존재하는 운동종목입니다.");
                        await loadExercises(query);
                      } catch (e: any) {
                        setError(e?.message ?? "운동종목 추가에 실패했습니다.");
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
        <h2>수정 / 삭제 (Update / Delete)</h2>
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
                    <div>
                      <div>
                        <strong>{item.name}</strong>
                      </div>
                      <div>
                        <button
                          type="button"
                          style={circleActionButtonStyle}
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
                          style={circleActionButtonStyle}
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
                              await apiDelete(`/api/exercises/${encodeURIComponent(item.id)}`);
                              setNotice("운동종목이 삭제되었습니다.");
                              await loadExercises(query);
                            } catch (e: any) {
                              setError(e?.message ?? "운동종목 삭제에 실패했습니다.");
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
                    <div>
                      <span>카테고리: {item.category ?? "미지정"}</span>
                      <span>별칭: {item.aliases.join(", ") || "-"}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <label>
                      <span>운동종목명</span>
                      <input
                        value={editing.name}
                        onChange={(event) =>
                          setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                        }
                      />
                    </label>
                    <label>
                      <span>카테고리</span>
                      <input
                        value={editing.category}
                        onChange={(event) =>
                          setEditing((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                        }
                      />
                    </label>
                    <CardActionGroup>
                      <button
                        type="button"
                        disabled={savingEdit || !editing.name.trim()}
                        onClick={async () => {
                          try {
                            setSavingEdit(true);
                            setNotice(null);
                            await apiPatch(`/api/exercises/${encodeURIComponent(editing.id)}`, {
                              name: editing.name.trim(),
                              category: editing.category.trim() || null,
                            });
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
