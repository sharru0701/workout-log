import { useRef } from "react";

export function SwipeableSetRow({
  children,
  onDelete,
  deleteLabel,
  disabled
}: {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel: string;
  disabled?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const offsetXRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
    if (rowRef.current) {
      rowRef.current.style.transition = "none";
      rowRef.current.style.willChange = "transform";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isDraggingRef.current || startXRef.current === null || !rowRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    if (diff < 0) {
      offsetXRef.current = Math.max(diff, -44);
    } else if (offsetXRef.current < 0) {
      offsetXRef.current = Math.min(0, offsetXRef.current + diff);
      startXRef.current = e.touches[0].clientX;
    } else {
      offsetXRef.current = 0;
    }
    rowRef.current.style.transform = offsetXRef.current !== 0 ? `translateX(${offsetXRef.current}px)` : "";
  };

  const handleTouchEnd = () => {
    if (disabled || !rowRef.current) return;
    isDraggingRef.current = false;
    rowRef.current.style.willChange = "auto";
    rowRef.current.style.transition = "transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)";
    if (offsetXRef.current < -22) {
      offsetXRef.current = -44;
      rowRef.current.style.transform = "translateX(-44px)";
    } else {
      offsetXRef.current = 0;
      rowRef.current.style.transform = "";
    }
  };

  return (
    <div style={{ position: "relative", clipPath: "inset(0 0 0 0 round 6px)", marginBottom: "var(--space-xs)" }}>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 0,
          width: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (rowRef.current) {
              rowRef.current.style.transform = "";
              rowRef.current.style.transition = "";
            }
            offsetXRef.current = 0;
            onDelete();
          }}
          style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-danger)", backgroundColor: "transparent", border: "none", boxShadow: "none", cursor: "pointer" }}
          aria-label={deleteLabel}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'wght' 400" }}>delete</span>
        </button>
      </div>
      <div
        ref={rowRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          position: "relative",
          zIndex: 1,
          backgroundColor: "var(--color-surface-container-low)",
          borderRadius: "6px",
          touchAction: "pan-y",
          padding: "2px 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}
