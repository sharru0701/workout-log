"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Card, CardActionGroup, CardContent } from "@/components/ui/card";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { SearchInput } from "@/components/ui/search-input";

function SwipeableExerciseRow({
  children,
  onDelete,
  disabled,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isDragging || startXRef.current === null) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    if (diff < 0) {
      setOffsetX(Math.max(diff, -72));
    } else if (offsetX < 0) {
      setOffsetX(Math.min(0, offsetX + diff));
      startXRef.current = currentXRef.current;
    } else {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    setIsDragging(false);
    if (offsetX < -36) {
      setOffsetX(-72);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "12px", marginBottom: "var(--space-sm)" }}>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setOffsetX(0);
            onDelete();
          }}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-danger)",
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
            cursor: "pointer",
          }}
          aria-label="운동종목 삭제"
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 22, fontVariationSettings: "'wght' 400" }}>delete</span>
        </button>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
          position: "relative",
          zIndex: 1,
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

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

function CategoryField({
  label,
  value,
  onChange,
  categories,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  categories: string[];
}) {
  const isInitiallyCustom = value !== "" && !categories.includes(value);
  const [customMode, setCustomMode] = useState(isInitiallyCustom);
  const selectValue = customMode ? "__custom__" : value;

  return (
    <div>
      <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>{label}</span>
      <AppSelect
        variant="compact"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(v);
          }
        }}
      >
        <option value="">미지정</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
        <option value="__custom__">직접 입력...</option>
      </AppSelect>
      {customMode && (
        <AppTextInput
          variant="compact"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="카테고리 직접 입력"
          style={{ marginTop: "var(--space-xs)" }}
        />
      )}
    </div>
  );
}

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
  const [createAliases, setCreateAliases] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);

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

  useEffect(() => {
    apiGet<{ categories: string[] }>("/api/exercises/categories")
      .then((res) => setCategories(res.categories ?? []))
      .catch(() => {});
  }, []);

  const visibleItems = useMemo(() => items, [items]);
  const listQueryKey = `exercise-catalog:${activeLoadQuery}`;
  const isListSettled = useQuerySettled(listQueryKey, loading);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-md)" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Exercise Library</span>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "2px 0 0" }}>운동 종목 관리</h1>
      </div>

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

      <section style={{ marginBottom: "var(--space-lg)" }}>

        <SearchInput
          bare
          value={query}
          onChange={setQuery}
          placeholder="운동종목 검색"
          ariaLabel="운동종목 검색"
        />
      </section>

      <section style={{ marginBottom: "var(--space-lg)" }}>

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
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  <label>
                    <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>운동종목명</span>
                    <AppTextInput
                      variant="compact"
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder="예: Incline Bench Press"
                    />
                  </label>
                  <CategoryField
                    label="카테고리 (선택)"
                    value={createCategory}
                    onChange={setCreateCategory}
                    categories={categories}
                  />
                  <label>
                    <span style={{ display: "block", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>별칭 (선택, 쉼표로 구분)</span>
                    <AppTextInput
                      variant="compact"
                      value={createAliases}
                      onChange={(event) => setCreateAliases(event.target.value)}
                      placeholder="예: 인클라인 벤치, Incline"
                    />
                  </label>
                </div>
                <CardActionGroup style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={savingCreate}
                    onClick={() => setCreateOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={savingCreate || !createName.trim()}
                    onClick={async () => {
                      try {
                        setSavingCreate(true);
                        setNotice(null);
                        const newName = createName.trim();
                        const newCategory = createCategory.trim() || null;
                        const newAliases = createAliases
                          .split(",")
                          .map((a) => a.trim())
                          .filter(Boolean);

                        // Optimistic UI for Create
                        const tempId = `temp-${Date.now()}`;
                        setItems((prev) => [
                          { id: tempId, name: newName, category: newCategory, aliases: newAliases },
                          ...prev,
                        ]);
                        setCreateName("");
                        setCreateCategory("");
                        setCreateAliases("");
                        setCreateOpen(false);

                        const res = await apiPost<ExerciseCreateResponse>("/api/exercises", {
                          name: newName,
                          category: newCategory,
                        });

                        if (res.exercise?.id && newAliases.length > 0) {
                          for (const alias of newAliases) {
                            await apiPost("/api/exercises/alias", {
                              exerciseId: res.exercise.id,
                              alias,
                            });
                          }
                        }

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

        <EmptyStateRows
          when={isListSettled && !error && visibleItems.length === 0}
          label="운동종목이 없습니다"
          description="상단에서 운동종목을 먼저 추가하세요."
        />

        {visibleItems.map((item) => {
          const editingThis = editing?.id === item.id;
          const deletingThis = deletingId === item.id;

          const handleDelete = async () => {
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
              setItems((prev) => prev.filter((it) => it.id !== item.id));
              await apiDelete(`/api/exercises/${encodeURIComponent(item.id)}`);
              setNotice("운동종목이 삭제되었습니다.");
              await loadExercises(query, true);
            } catch (e: any) {
              setError(e?.message ?? "운동종목 삭제에 실패했습니다.");
              void loadExercises(query, true);
            } finally {
              setDeletingId(null);
            }
          };

          return (
            <SwipeableExerciseRow key={item.id} onDelete={handleDelete} disabled={editingThis || deletingThis}>
            <Card padding="md" elevated={false} tone="default" style={{ marginBottom: 0 }}>
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
                          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 22, fontVariationSettings: "'wght' 400" }}>edit</span>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
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
                      <CategoryField
                        key={editing.id}
                        label="카테고리"
                        value={editing.category}
                        onChange={(v) => setEditing((prev) => (prev ? { ...prev, category: v } : prev))}
                        categories={categories}
                      />
                    </div>
                    <CardActionGroup style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                        onClick={() => setEditing(null)}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1 }}
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
                    </CardActionGroup>
                  </>
                )}
              </CardContent>
            </Card>
            </SwipeableExerciseRow>
          );
        })}
      </section>
    </div>
  );
}
