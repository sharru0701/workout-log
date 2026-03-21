"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "./modal";
import { WheelPicker, generateNumberRange } from "./wheel-picker";

export type MonthYearPickerSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  year: number;
  month: number;
  minYear: number;
  maxYear: number;
  onChange: (value: { year: number; month: number }) => void;
};

export function MonthYearPickerSheet({
  open,
  onClose,
  title,
  year,
  month,
  minYear,
  maxYear,
  onChange,
}: MonthYearPickerSheetProps) {
  const [draftYear, setDraftYear] = useState(year);
  const [draftMonth, setDraftMonth] = useState(month);

  const years = useMemo(() => generateNumberRange(minYear, maxYear, 1), [minYear, maxYear]);
  const months = useMemo(() => generateNumberRange(1, 12, 1), []);

  useEffect(() => {
    if (!open) return;
    setDraftYear(year);
    setDraftMonth(month);
  }, [month, open, year]);

  const handleConfirm = useCallback(() => {
    onChange({ year: draftYear, month: draftMonth });
    onClose();
  }, [draftMonth, draftYear, onChange, onClose]);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      closeLabel="닫기"
      panelClassName="month-year-picker-sheet-panel"
      primaryAction={{
        ariaLabel: "확인",
        onPress: handleConfirm,
      }}
      footer={null}
    >
      <div style={{ padding: "var(--space-sm) 0 var(--space-md)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-md)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", marginBottom: "var(--space-sm)", font: "var(--font-card-title)", color: "var(--color-text-muted)" }}>연도</span>
            <WheelPicker
              values={years}
              value={draftYear}
              onChange={setDraftYear}
              itemHeight={48}
              visibleCount={7}
              formatValue={(value) => `${value}년`}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", marginBottom: "var(--space-sm)", font: "var(--font-card-title)", color: "var(--color-text-muted)" }}>월</span>
            <WheelPicker
              values={months}
              value={draftMonth}
              onChange={setDraftMonth}
              itemHeight={48}
              visibleCount={7}
              formatValue={(value) => `${value}월`}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
