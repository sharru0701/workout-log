"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Card, CardContent } from "@/components/ui/card";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { SearchInput } from "@/components/ui/search-input";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExerciseItem = {
  id: string;
  name: string;
  category: string | null;
  aliases: string[];
};

type ExerciseResponse = { items: ExerciseItem[] };

type ExerciseCreateResponse = {
  exercise: { id: string; name: string; category: string | null } | null;
  created: boolean;
};

type EditingState = { id: string; name: string; category: string };

// ─── Swipeable delete row ─────────────────────────────────────────────────────

function SwipeableExerciseRow({
  children,
  onDelete,
  disabled,
}: {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (disabled || !isDragging || startXRef.current === null) return;
    const diff = e.touches[0].clientX - startXRef.current;
    if (diff < 0) {
      setOffsetX(Math.max(diff, -72));
    } else if (offsetX < 0) {
      setOffsetX(Math.min(0, offsetX + diff));
      startXRef.current = e.touches[0].clientX;
    } else {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    setIsDragging(false);
    setOffsetX(offsetX < -36 ? -72 : 0);
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "12px" }}>
      {/* Swipe-revealed delete button */}
      <div
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 72,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <button
          type="button"
          className="btn btn-icon btn-icon-danger"
          onClick={() => { setOffsetX(0); onDelete(); }}
          aria-label="운동종목 삭제"
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20 }}>delete</span>
        </button>
      </div>

      {/* Draggable content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
          position: "relative", zIndex: 1, touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_LABEL_CLASS: Record<string, string> = {
  chest:      "label-primary",
  back:       "label-warning",
  legs:       "label-muscle",
  quads:      "label-muscle",
  hamstrings: "label-muscle",
  glutes:     "label-muscle",
  shoulders:  "label-accent",
  arms:       "label-info",
  biceps:     "label-info",
  triceps:    "label-info",
  core:       "label-set-type",
  cardio:     "label-complete",
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const cls = CATEGORY_LABEL_CLASS[category.toLowerCase()] ?? "label-neutral";
  return (
    <span className={`label label-sm ${cls}`}>
      {category}
    </span>
  );
}

// ─── Category field (select + custom) ────────────────────────────────────────

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      <FieldLabel>{label}</FieldLabel>
      <AppSelect
        variant="compact"
        value={customMode ? "__custom__" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") { setCustomMode(true); onChange(""); }
          else { setCustomMode(false); onChange(v); }
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
        />
      )}
    </div>
  );
}

// ─── Shared field label ───────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-label-family)",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: "var(--color-text-muted)",
    }}>
      {children}
    </span>
  );
}

// ─── Inline exercise form (create or edit) ────────────────────────────────────

function InlineExerciseForm({
  name,
  onNameChange,
  category,
  onCategoryChange,
  aliases,
  onAliasesChange,
  categories,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  name: string;
  onNameChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  aliases?: string;
  onAliasesChange?: (v: string) => void;
  categories: string[];
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <Card padding="md" tone="default" elevated={false}>
      <CardContent>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {/* Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <FieldLabel>운동종목명</FieldLabel>
            <AppTextInput
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="예: Incline Bench Press"
              autoFocus
            />
          </div>

          {/* Category + Aliases grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: aliases !== undefined ? "1fr 1fr" : "1fr",
            gap: "var(--space-md)",
          }}>
            <CategoryField
              label="카테고리"
              value={category}
              onChange={onCategoryChange}
              categories={categories}
            />
            {aliases !== undefined && onAliasesChange && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <FieldLabel>별칭 (쉼표 구분)</FieldLabel>
                <AppTextInput
                  variant="compact"
                  value={aliases}
                  onChange={(e) => onAliasesChange(e.target.value)}
                  placeholder="예: 인클라인, Incline"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={onCancel}
              disabled={saving}
            >
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={onSubmit}
              disabled={saving || !name.trim()}
            >
              {saving ? `${submitLabel} 중...` : submitLabel}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Exercise row (view mode) ─────────────────────────────────────────────────

function ExerciseRowView({
  item,
  onEdit,
  onDelete,
  disabled,
}: {
  item: ExerciseItem;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-md)",
      backgroundColor: "var(--color-surface-container-low)",
      border: "1px solid var(--color-border)",
      borderRadius: "12px",
      gap: "var(--space-sm)",
    }}>
      {/* Left content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" as const }}>
          <span style={{ font: "var(--font-card-title)", color: "var(--color-text)" }}>
            {item.name}
          </span>
          <CategoryBadge category={item.category} />
        </div>
        {item.aliases.length > 0 && (
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>
            별칭: {item.aliases.join(", ")}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-icon"
          aria-label={`${item.name} 수정`}
          disabled={disabled}
          onClick={onEdit}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>edit</span>
        </button>
        <button
          type="button"
          className="btn btn-icon btn-icon-danger"
          aria-label={`${item.name} 삭제`}
          disabled={disabled}
          onClick={onDelete}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>delete</span>
        </button>
      </div>
    </div>
  );
}

// ─── Stats bento grid ─────────────────────────────────────────────────────────

function StatsGrid({ total, items }: { total: number; items: ExerciseItem[] }) {
  const avatars = useMemo(() =>
    items.slice(0, 3).map((it) => {
      const words = it.name.trim().split(/\s+/);
      return words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : it.name.slice(0, 2).toUpperCase();
    }),
    [items]
  );

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "var(--space-sm)",
      marginBottom: "var(--space-lg)",
    }}>
      {/* Total count tile */}
      <div style={{
        backgroundColor: "var(--color-surface-container-low)",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        padding: "var(--space-md)",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        minHeight: "96px",
      }}>
        <span style={{
          fontFamily: "var(--font-label-family)",
          fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.15em", textTransform: "uppercase" as const,
          color: "var(--color-text-subtle)",
        }}>
          전체 종목
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{
            fontFamily: "var(--font-label-family)",
            fontSize: "36px", fontWeight: 700, lineHeight: 1,
            color: "var(--color-primary)",
          }}>
            {total}
          </span>
          <span style={{
            fontFamily: "var(--font-label-family)",
            fontSize: "11px",
            color: "var(--color-text-subtle)",
          }}>
            종목
          </span>
        </div>
      </div>

      {/* Recent exercises tile */}
      <div style={{
        backgroundColor: "var(--color-action-weak)",
        border: "1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border))",
        borderRadius: "12px",
        padding: "var(--space-md)",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        minHeight: "96px",
      }}>
        <span style={{
          fontFamily: "var(--font-label-family)",
          fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.15em", textTransform: "uppercase" as const,
          color: "var(--color-text-muted)",
        }}>
          최근 종목
        </span>
        {avatars.length > 0 ? (
          <div style={{ display: "flex" }}>
            {avatars.map((initials, i) => (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: "9999px",
                backgroundColor: "var(--color-surface-container-high)",
                border: "2px solid var(--color-surface-container-low)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-label-family)",
                fontSize: "10px", fontWeight: 700,
                color: "var(--color-text)",
                marginLeft: i > 0 ? "-8px" : "0",
                position: "relative" as const,
                zIndex: avatars.length - i,
              }}>
                {initials}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-subtle)" }}>—</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // Create form state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [createAliases, setCreateAliases] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);

  // Edit state
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadExercises = useCallback(async (search = "", isSilent = false) => {
    const requestId = ++loadRequestIdRef.current;
    try {
      if (!catalogLoadedRef.current && !isSilent) setLoading(true);
      setError(null);
      const normalized = search.trim().toLowerCase();
      setActiveLoadQuery(normalized);
      const params = new URLSearchParams({ limit: "200" });
      if (normalized) params.set("query", normalized);
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
    const id = window.setTimeout(() => void loadExercises(query), 220);
    return () => window.clearTimeout(id);
  }, [loadExercises, query]);

  useEffect(() => {
    apiGet<{ categories: string[] }>("/api/exercises/categories")
      .then((res) => setCategories(res.categories ?? []))
      .catch(() => {});
  }, []);

  const visibleItems = useMemo(() => items, [items]);
  const listQueryKey = `exercise-catalog:${activeLoadQuery}`;
  const isListSettled = useQuerySettled(listQueryKey, loading);

  // ── Create ──────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    try {
      setSavingCreate(true);
      setNotice(null);
      const newName = createName.trim();
      const newCategory = createCategory.trim() || null;
      const newAliases = createAliases.split(",").map((a) => a.trim()).filter(Boolean);

      // Optimistic
      const tempId = `temp-${Date.now()}`;
      setItems((prev) => [{ id: tempId, name: newName, category: newCategory, aliases: newAliases }, ...prev]);
      setCreateName(""); setCreateCategory(""); setCreateAliases("");
      setCreateOpen(false);

      const res = await apiPost<ExerciseCreateResponse>("/api/exercises", { name: newName, category: newCategory });
      if (res.exercise?.id && newAliases.length > 0) {
        for (const alias of newAliases) {
          await apiPost("/api/exercises/alias", { exerciseId: res.exercise.id, alias });
        }
      }
      setNotice(res.created ? "운동종목이 추가되었습니다." : "이미 존재하는 운동종목입니다.");
      await loadExercises(query, true);
    } catch (e: any) {
      setError(e?.message ?? "운동종목 추가에 실패했습니다.");
      void loadExercises(query, true);
    } finally {
      setSavingCreate(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────

  const handleEdit = async () => {
    if (!editing) return;
    try {
      setSavingEdit(true);
      setNotice(null);
      const { id: targetId, name: rawName, category: rawCat } = editing;
      const newName = rawName.trim();
      const newCategory = rawCat.trim() || null;

      // Optimistic
      setItems((prev) => prev.map((it) => it.id === targetId ? { ...it, name: newName, category: newCategory } : it));
      setEditing(null);

      await apiPatch(`/api/exercises/${encodeURIComponent(targetId)}`, { name: newName, category: newCategory });
      setNotice("운동종목이 수정되었습니다.");
      await loadExercises(query, true);
    } catch (e: any) {
      setError(e?.message ?? "운동종목 수정에 실패했습니다.");
      void loadExercises(query, true);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const makeDeleteHandler = (item: ExerciseItem) => async () => {
    const ok = await confirm({
      title: "운동종목 삭제",
      message: `'${item.name}' 종목을 삭제하시겠습니까?\n기록에 연결된 exerciseId는 자동 해제됩니다.`,
      confirmText: "삭제",
      cancelText: "취소",
      tone: "danger",
    });
    if (!ok) return;
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Editorial page header */}
      <div style={{
        marginBottom: "var(--space-xl)",
        paddingBottom: "var(--space-md)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <div style={{
          fontFamily: "var(--font-label-family)",
          fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: "var(--color-primary)",
          marginBottom: "4px",
        }}>
          Exercise Library
        </div>
        <h1 style={{
          fontFamily: "var(--font-headline-family)",
          fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px",
          color: "var(--color-text)",
          margin: "0 0 var(--space-sm)",
        }}>
          운동 종목 관리
        </h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
          종목을 추가·수정하거나 카테고리와 별칭을 관리합니다.
        </p>
      </div>

      {/* Status */}
      <LoadingStateRows active={loading} delayMs={120} label="운동종목 목록 로딩 중" description="DB 저장 종목을 조회하고 있습니다." />
      <ErrorStateRows message={error} title="운동종목 목록 조회 실패" onRetry={() => void loadExercises(query)} />
      <NoticeStateRows message={notice} label="안내" />

      {/* Search */}
      <div style={{ marginBottom: "var(--space-md)" }}>
        <SearchInput
          bare
          value={query}
          onChange={setQuery}
          placeholder="운동종목 검색"
          ariaLabel="운동종목 검색"
        />
      </div>

      {/* Stats bento */}
      <StatsGrid total={visibleItems.length} items={visibleItems} />

      {/* Inline create form */}
      {createOpen && (
        <div style={{ marginBottom: "var(--space-md)" }}>
          <InlineExerciseForm
            name={createName}
            onNameChange={setCreateName}
            category={createCategory}
            onCategoryChange={setCreateCategory}
            aliases={createAliases}
            onAliasesChange={setCreateAliases}
            categories={categories}
            onSubmit={handleCreate}
            onCancel={() => { setCreateOpen(false); setCreateName(""); setCreateCategory(""); setCreateAliases(""); }}
            saving={savingCreate}
            submitLabel="저장"
          />
        </div>
      )}

      {/* Add button (hidden while form is open) */}
      {!createOpen && (
        <button
          type="button"
          className="btn btn-secondary btn-full"
          style={{ marginBottom: "var(--space-lg)", display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-xs)" }}
          onClick={() => setCreateOpen(true)}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>add</span>
          운동종목 추가
        </button>
      )}

      {/* Section header */}
      <h2 style={{
        fontFamily: "var(--font-headline-family)",
        fontSize: "13px", fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase" as const,
        color: "var(--color-text-muted)",
        margin: "0 0 var(--space-sm)",
      }}>
        Active Catalog
      </h2>

      {/* Exercise list */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        <EmptyStateRows
          when={isListSettled && !error && visibleItems.length === 0}
          label="운동종목이 없습니다"
          description="상단 버튼으로 운동종목을 추가하세요."
        />

        {visibleItems.map((item) => {
          const deletingThis = deletingId === item.id;
          const editingThis = editing?.id === item.id;

          if (editingThis && editing) {
            return (
              <InlineExerciseForm
                key={item.id}
                name={editing.name}
                onNameChange={(v) => setEditing((p) => p ? { ...p, name: v } : p)}
                category={editing.category}
                onCategoryChange={(v) => setEditing((p) => p ? { ...p, category: v } : p)}
                categories={categories}
                onSubmit={handleEdit}
                onCancel={() => setEditing(null)}
                saving={savingEdit}
                submitLabel="수정 저장"
              />
            );
          }

          return (
            <SwipeableExerciseRow
              key={item.id}
              onDelete={makeDeleteHandler(item)}
              disabled={deletingThis}
            >
              <ExerciseRowView
                item={item}
                disabled={deletingThis}
                onEdit={() => setEditing({ id: item.id, name: item.name, category: item.category ?? "" })}
                onDelete={makeDeleteHandler(item)}
              />
            </SwipeableExerciseRow>
          );
        })}
      </section>
    </div>
  );
}
