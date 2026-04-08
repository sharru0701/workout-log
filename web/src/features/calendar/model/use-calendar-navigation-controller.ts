"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMonth,
  getYear,
  setMonthOfDate,
  shiftDateByMonths,
} from "@/lib/date-utils";

type UseCalendarNavigationControllerInput = {
  initialToday: string;
};

export function useCalendarNavigationController({
  initialToday,
}: UseCalendarNavigationControllerInput) {
  const [anchorDate, setAnchorDate] = useState(initialToday);
  const [selectedDate, setSelectedDate] = useState(initialToday);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthNavFeedback, setMonthNavFeedback] = useState<"" | "prev" | "next">("");
  const monthNavFeedbackTimerRef = useRef<number | null>(null);

  function setCalendarMonth(value: { year: number; month: number }) {
    const currentMonthValue = getYear(anchorDate) * 12 + getMonth(anchorDate);
    const nextMonthValue = value.year * 12 + value.month;
    if (nextMonthValue === currentMonthValue) return;

    const nextAnchorDate = setMonthOfDate(anchorDate, value.year, value.month);
    const nextSelectedDate = setMonthOfDate(selectedDate, value.year, value.month);
    setAnchorDate(nextAnchorDate);
    setSelectedDate(nextSelectedDate);
  }

  function shiftMonth(delta: number) {
    const nextAnchorDate = shiftDateByMonths(anchorDate, delta);
    setCalendarMonth({
      year: getYear(nextAnchorDate),
      month: getMonth(nextAnchorDate),
    });
  }

  function shiftMonthWithFeedback(delta: number) {
    setMonthNavFeedback(delta < 0 ? "prev" : "next");
    if (monthNavFeedbackTimerRef.current !== null) {
      window.clearTimeout(monthNavFeedbackTimerRef.current);
      monthNavFeedbackTimerRef.current = null;
    }

    monthNavFeedbackTimerRef.current = window.setTimeout(() => {
      setMonthNavFeedback("");
      monthNavFeedbackTimerRef.current = null;
    }, 240);

    shiftMonth(delta);
  }

  function handleMonthPickerChange(value: { year: number; month: number }) {
    setCalendarMonth(value);
    setMonthPickerOpen(false);
  }

  function selectDate(dateOnly: string) {
    setSelectedDate(dateOnly);
  }

  function focusDate(dateOnly: string) {
    setAnchorDate(dateOnly);
    setSelectedDate(dateOnly);
  }

  useEffect(
    () => () => {
      if (monthNavFeedbackTimerRef.current === null) return;
      window.clearTimeout(monthNavFeedbackTimerRef.current);
      monthNavFeedbackTimerRef.current = null;
    },
    [],
  );

  return {
    anchorDate,
    selectedDate,
    monthPickerOpen,
    setMonthPickerOpen,
    monthNavFeedback,
    shiftMonthWithFeedback,
    handleMonthPickerChange,
    selectDate,
    focusDate,
  };
}
