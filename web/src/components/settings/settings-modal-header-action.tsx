"use client";

import { createContext, useContext, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import type { BottomSheetPrimaryAction } from "@/components/ui/bottom-sheet-action-header";

export type SettingsModalHeaderAction = BottomSheetPrimaryAction;

type SettingsModalHeaderActionContextValue = {
  action: SettingsModalHeaderAction | null;
  setAction: (action: SettingsModalHeaderAction | null) => void;
};

const SettingsModalHeaderActionContext = createContext<SettingsModalHeaderActionContextValue | null>(null);

export function SettingsModalHeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<SettingsModalHeaderAction | null>(null);

  const value = useMemo(
    () => ({
      action,
      setAction,
    }),
    [action],
  );

  return <SettingsModalHeaderActionContext.Provider value={value}>{children}</SettingsModalHeaderActionContext.Provider>;
}

function useSettingsModalHeaderActionContext() {
  const context = useContext(SettingsModalHeaderActionContext);
  if (!context) {
    throw new Error("SettingsModalHeaderActionContext is not available.");
  }
  return context;
}

export function useSettingsModalHeaderAction(action: SettingsModalHeaderAction | null) {
  const { setAction } = useSettingsModalHeaderActionContext();
  const isActive = action !== null;
  const ariaLabel = action?.ariaLabel ?? "";
  const disabled = action?.disabled ?? false;
  const handlePress = useEffectEvent(() => {
    action?.onPress();
  });

  useEffect(() => {
    if (!isActive) {
      setAction(null);
      return;
    }

    setAction({
      ariaLabel,
      disabled,
      onPress: handlePress,
    });
  }, [ariaLabel, disabled, isActive, setAction]);

  useEffect(() => () => setAction(null), [setAction]);
}

export function useSettingsModalHeaderActionState() {
  return useSettingsModalHeaderActionContext().action;
}
