"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_COOKIE_NAME,
  getAppCopy,
  type AppCopy,
  type AppLocale,
} from "@/lib/i18n/messages";

type LocaleContextValue = {
  locale: AppLocale;
  copy: AppCopy;
  setLocale: (locale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function writeLocaleCookie(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    applyDocumentLocale(locale);
    writeLocaleCookie(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    copy: getAppCopy(locale),
    setLocale(nextLocale) {
      startTransition(() => {
        setLocaleState(nextLocale);
      });
    },
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
