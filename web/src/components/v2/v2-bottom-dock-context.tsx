"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { V2ActionDockItem } from "./primitives";

type V2BottomDockRegistration = {
  id: string;
  items: V2ActionDockItem[];
};

type V2BottomDockContextValue = {
  registration: V2BottomDockRegistration | null;
  setRegistration: Dispatch<SetStateAction<V2BottomDockRegistration | null>>;
};

const V2BottomDockContext = createContext<V2BottomDockContextValue | null>(null);

export function V2BottomDockProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] =
    useState<V2BottomDockRegistration | null>(null);

  const value = useMemo(
    () => ({ registration, setRegistration }),
    [registration, setRegistration],
  );

  return (
    <V2BottomDockContext.Provider value={value}>
      {children}
    </V2BottomDockContext.Provider>
  );
}

export function useV2BottomDockRegistration() {
  return useContext(V2BottomDockContext)?.registration ?? null;
}

export function useV2BottomDockTabs(
  registration: V2BottomDockRegistration | null,
) {
  const setRegistration = useContext(V2BottomDockContext)?.setRegistration;
  const registrationId = registration?.id;

  useEffect(() => {
    if (!setRegistration || !registration) return;
    setRegistration(registration);
  }, [setRegistration, registration]);

  useEffect(() => {
    if (!setRegistration || !registrationId) return;

    return () => {
      setRegistration((current) =>
        current?.id === registrationId ? null : current,
      );
    };
  }, [setRegistration, registrationId]);
}
