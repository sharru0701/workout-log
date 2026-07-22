import { StickyActionBar } from "@/components/ui/page-layout";

/** 세트 진행률 게이지 + 저장 버튼. 세트가 하나도 없으면 게이지는 생략한다. */
export function SessionSaveBar({
  completedSetsCount,
  totalSetsCount,
  saving,
  isEditingExistingLog,
  onSave,
  locale,
  copy,
}: {
  completedSetsCount: number;
  totalSetsCount: number;
  saving: boolean;
  isEditingExistingLog: boolean;
  onSave: () => void;
  locale: string;
  copy: {
    saveInProgress: string;
    saveEdited: string;
    saveCreate: string;
  };
}) {
  const complete = completedSetsCount >= totalSetsCount;

  return (
    <StickyActionBar>
      {totalSetsCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--v2-s-2)",
            paddingBottom: "var(--v2-s-2)",
          }}
          aria-label={
            locale === "ko"
              ? `세트 진행률 ${completedSetsCount}/${totalSetsCount}`
              : `Sets progress ${completedSetsCount}/${totalSetsCount}`
          }
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSetsCount}
          aria-valuenow={completedSetsCount}
        >
          <span
            className="v2-mono-label"
            style={{
              color: complete ? "var(--v2-c-success)" : "var(--v2-ink-3)",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {completedSetsCount}/{totalSetsCount}{" "}
            {locale === "ko" ? "세트" : "sets"}
          </span>
          <div
            style={{
              flex: 1,
              height: "var(--v2-s-1)",
              borderRadius: "var(--v2-r-pill)",
              background: "var(--v2-paper-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (completedSetsCount / Math.max(1, totalSetsCount)) * 100)}%`,
                height: "100%",
                background: complete ? "var(--v2-c-success)" : "var(--v2-accent)",
                transition: "width 200ms ease, background 200ms ease",
              }}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="v2-font-display"
        style={{
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--v2-s-2)",
          padding: "var(--v2-s-3) var(--v2-s-4)",
          borderRadius: "var(--v2-r-3)",
          background: saving ? "var(--v2-paper-2)" : "var(--v2-c-success)",
          color: saving ? "var(--v2-ink-3)" : "var(--v2-ink-on-accent)",
          border: "none",
          cursor: saving ? "not-allowed" : "pointer",
          fontWeight: 700,
          minHeight: "var(--v2-s-8)",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "var(--v2-t-18)" }}
          aria-hidden
        >
          done_all
        </span>
        {saving
          ? copy.saveInProgress
          : isEditingExistingLog
            ? copy.saveEdited
            : copy.saveCreate}
      </button>
    </StickyActionBar>
  );
}
