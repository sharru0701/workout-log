"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { SearchInput } from "@/components/ui/search-input";
import { Modal } from "@/components/ui/modal";

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
  const currentXRef = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
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
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "12px" }}>
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
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 22 }}>delete</span>
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  chest:      { bg: "color-mix(in srgb, var(--color-info) 14%, var(--color-surface-container-low))",    text: "var(--color-info)" },
  back:       { bg: "color-mix(in srgb, var(--color-warning) 14%, var(--color-surface-container-low))", text: "var(--color-warning)" },
  legs:       { bg: "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-container-low))", text: "var(--color-primary)" },
  shoulders:  { bg: "color-mix(in srgb, var(--color-accent) 14%, var(--color-surface-container-low))",  text: "var(--color-accent)" },
  arms:       { bg: "color-mix(in srgb, var(--color-success) 14%, var(--color-surface-container-low))", text: "var(--color-success-strong)" },
  core:       { bg: "color-mix(in srgb, var(--color-cta) 12%, var(--color-surface-container-low))",     text: "var(--color-cta-strong)" },
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const key = category.toLowerCase();
  const colors = CATEGORY_COLORS[key] ?? {
    bg: "color-mix(in srgb, var(--color-text-muted) 12%, var(--color-surface-container-low))",
    text: "var(--color-text-muted)",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "10px",
        fontFamily: "var(--font-label-family)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        backgroundColor: colors.bg,
        color: colors.text,
        flexShrink: 0,
      }}
    >
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
  const selectValue = customMode ? "__custom__" : value;

  return (
    <div>
      <span style={{ display: "block", marginBottom: "var(--space-xs)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{label}</span>
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

// ─── Form field label ─────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: "block",
      marginBottom: "var(--space-xs)",
      fontSize: "10px",
      fontFamily: "var(--font-label-family)",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--color-text-muted)",
    }}>
      {children}
    </span>
  );
}

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRow({
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
    <SwipeableExerciseRow onDelete={onDelete} disabled={disabled}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-md)",
          backgroundColor: "var(--color-surface-container-low)",
          border: "1px solid var(--color-border)",
          borderRadius: "12px",
          gap: "var(--space-sm)",
          transition: "background-color 0.15s ease",
        }}
      >
        {/* Left: name + category + alias */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "var(--font-headline-family)",
              fontWeight: 600,
              fontSize: "15px",
              color: "var(--color-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {item.name}
            </span>
            <CategoryBadge category={item.category} />
          </div>
          {item.aliases.length > 0 && (
            <span style={{
              fontSize: "12px",
              color: "var(--color-text-subtle)",
              fontFamily: "var(--font-family)",
            }}>
              별칭: {item.aliases.join(", ")}
            </span>
          )}
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
          <button
            type="button"
            aria-label={`${item.name} 수정`}
            disabled={disabled}
            onClick={onEdit}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "color-mix(in srgb, var(--color-primary) 10%, transparent)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>edit</span>
          </button>
          <button
            type="button"
            aria-label={`${item.name} 삭제`}
            disabled={disabled}
            onClick={onDelete}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "color-mix(in srgb, var(--color-danger) 10%, transparent)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>delete</span>
          </button>
        </div>
      </div>
    </SwipeableExerciseRow>
  );
}

// ─── Stats bento grid ─────────────────────────────────────────────────────────

function StatsGrid({ total, items }: { total: number; items: ExerciseItem[] }) {
  // Pick up to 3 recently visible items for avatar initials
  const recentAvatars = useMemo(() => {
    return items.slice(0, 3).map((it) => {
      const words = it.name.trim().split(/\s+/);
      return words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : it.name.slice(0, 2).toUpperCase();
    });
  }, [items]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "var(--space-lg)" }}>
      {/* Total movements */}
      <div style={{
        backgroundColor: "var(--color-surface-container-low)",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        padding: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "100px",
      }}>
        <span style={{
          fontSize: "10px",
          fontFamily: "var(--font-label-family)",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}>
          전체 종목
        </span>
        <span style={{
          fontSize: "36px",
          fontFamily: "var(--font-label-family)",
          fontWeight: 700,
          lineHeight: 1,
          color: "var(--color-primary)",
        }}>
          {total}
        </span>
      </div>

      {/* Recently shown */}
      <div style={{
        backgroundColor: "color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-container-low))",
        border: "1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border))",
        borderRadius: "12px",
        padding: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "100px",
      }}>
        <span style={{
          fontSize: "10px",
          fontFamily: "var(--font-label-family)",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}>
          최근 종목
        </span>
        {recentAvatars.length > 0 ? (
          <div style={{ display: "flex", marginLeft: "4px" }}>
            {recentAvatars.map((initials, i) => (
              <div
                key={i}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "9999px",
                  backgroundColor: "var(--color-surface-container-highest)",
                  border: "2px solid var(--color-surface-container-low)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontFamily: "var(--font-label-family)",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginLeft: i > 0 ? "-8px" : "0",
                  zIndex: recentAvatars.length - i,
                  position: "relative",
                }}
              >
                {initials}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--color-text-subtle)" }}>—</span>
        )}
      </div>
    </div>
  );
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

function ExerciseFormModal({
  open,
  onClose,
  title,
  name,
  onNameChange,
  category,
  onCategoryChange,
  aliases,
  onAliasesChange,
  showAliases,
  categories,
  onSubmit,
  saving,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  name: string;
  onNameChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  aliases?: string;
  onAliasesChange?: (v: string) => void;
  showAliases: boolean;
  categories: string[];
  onSubmit: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        ariaLabel: saving ? `${submitLabel} 중...` : submitLabel,
        onPress: onSubmit,
        disabled: saving || !name.trim(),
      }}
      closeLabel="취소"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        {/* Primary name */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <FieldLabel>운동종목명</FieldLabel>
          <AppTextInput
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="예: Incline Bench Press"
            autoFocus
          />
        </label>

        {/* Category */}
        <CategoryField
          label="카테고리 (선택)"
          value={category}
          onChange={onCategoryChange}
          categories={categories}
        />

        {/* Aliases – only for create */}
        {showAliases && aliases !== undefined && onAliasesChange && (
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <FieldLabel>별칭 (선택, 쉼표로 구분)</FieldLabel>
            <AppTextInput
              value={aliases}
              onChange={(e) => onAliasesChange(e.target.value)}
              placeholder="예: 인클라인 벤치, Incline"
            />
          </label>
        )}
      </div>
    </Modal>
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
      if (normalizedSearch) params.set("query", normalizedSearch);
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
    return () => window.clearTimeout(timeoutId);
  }, [loadExercises, query]);

  useEffect(() => {
    apiGet<{ categories: string[] }>("/api/exercises/categories")
      .then((res) => setCategories(res.categories ?? []))
      .catch(() => {});
  }, []);

  const visibleItems = useMemo(() => items, [items]);
  const listQueryKey = `exercise-catalog:${activeLoadQuery}`;
  const isListSettled = useQuerySettled(listQueryKey, loading);

  // ── Create handler ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      setSavingCreate(true);
      setNotice(null);
      const newName = createName.trim();
      const newCategory = createCategory.trim() || null;
      const newAliases = createAliases.split(",").map((a) => a.trim()).filter(Boolean);

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

  // ── Edit handler ────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editing) return;
    try {
      setSavingEdit(true);
      setNotice(null);
      const targetId = editing.id;
      const newName = editing.name.trim();
      const newCategory = editing.category.trim() || null;

      setItems((prev) =>
        prev.map((it) => (it.id === targetId ? { ...it, name: newName, category: newCategory } : it))
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
      void loadExercises(query, true);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete handler ──────────────────────────────────────────────────────────
  const makeDeleteHandler = (item: ExerciseItem) => async () => {
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: "80px" }}>
      {/* Page header */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <span style={{
          fontSize: "10px",
          fontFamily: "var(--font-label-family)",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}>
          Exercise Library
        </span>
        <h1 style={{
          fontSize: "22px",
          fontWeight: 800,
          letterSpacing: "-0.5px",
          color: "var(--color-text)",
          margin: "2px 0 0",
        }}>
          운동 종목 관리
        </h1>
      </div>

      {/* Status rows */}
      <LoadingStateRows
        active={loading}
        delayMs={120}
        label="운동종목 목록 로딩 중"
        description="DB 저장 종목을 조회하고 있습니다."
      />
      <ErrorStateRows
        message={error}
        title="운동종목 목록 조회 실패"
        onRetry={() => { void loadExercises(query); }}
      />
      <NoticeStateRows message={notice} label="안내" />

      {/* Search */}
      <section style={{ marginBottom: "var(--space-md)" }}>
        <SearchInput
          bare
          value={query}
          onChange={setQuery}
          placeholder="운동종목 검색"
          ariaLabel="운동종목 검색"
        />
      </section>

      {/* Stats bento */}
      <StatsGrid total={visibleItems.length} items={visibleItems} />

      {/* Section label */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--space-sm)",
        padding: "0 2px",
      }}>
        <span style={{
          fontSize: "10px",
          fontFamily: "var(--font-label-family)",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}>
          Active Catalog
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-text-muted)" }}>filter_list</span>
      </div>

      {/* Exercise list */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        <EmptyStateRows
          when={isListSettled && !error && visibleItems.length === 0}
          label="운동종목이 없습니다"
          description="하단 버튼으로 운동종목을 추가하세요."
        />

        {visibleItems.map((item) => {
          const deletingThis = deletingId === item.id;
          const editingThis = editing?.id === item.id;
          return (
            <ExerciseRow
              key={item.id}
              item={item}
              disabled={deletingThis || editingThis}
              onEdit={() => setEditing({ id: item.id, name: item.name, category: item.category ?? "" })}
              onDelete={makeDeleteHandler(item)}
            />
          );
        })}
      </section>

      {/* Bottom add button */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        padding: "var(--space-lg) var(--space-md)",
        background: "linear-gradient(to top, var(--color-bg) 60%, transparent)",
        display: "flex",
        justifyContent: "center",
        zIndex: 20,
        pointerEvents: "none",
      }}>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "var(--color-text)",
            color: "var(--color-bg)",
            padding: "14px 28px",
            borderRadius: "9999px",
            border: "none",
            fontFamily: "var(--font-headline-family)",
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: "0.01em",
            cursor: "pointer",
            boxShadow: "0 4px 24px color-mix(in srgb, var(--color-text) 20%, transparent)",
            pointerEvents: "auto",
            transition: "opacity 0.15s ease, transform 0.1s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
          운동종목 추가
        </button>
      </div>

      {/* Create modal */}
      <ExerciseFormModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateName(""); setCreateCategory(""); setCreateAliases(""); }}
        title="New Movement"
        name={createName}
        onNameChange={setCreateName}
        category={createCategory}
        onCategoryChange={setCreateCategory}
        aliases={createAliases}
        onAliasesChange={setCreateAliases}
        showAliases
        categories={categories}
        onSubmit={handleCreate}
        saving={savingCreate}
        submitLabel="저장"
      />

      {/* Edit modal */}
      <ExerciseFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="운동종목 수정"
        name={editing?.name ?? ""}
        onNameChange={(v) => setEditing((prev) => (prev ? { ...prev, name: v } : prev))}
        category={editing?.category ?? ""}
        onCategoryChange={(v) => setEditing((prev) => (prev ? { ...prev, category: v } : prev))}
        showAliases={false}
        categories={categories}
        onSubmit={handleEdit}
        saving={savingEdit}
        submitLabel="수정 저장"
      />
    </div>
  );
}
