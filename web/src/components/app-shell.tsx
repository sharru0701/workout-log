"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { LocaleProvider } from "@/components/locale-provider";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";
import type { AppLocale } from "@/lib/i18n/messages";

export function AppShell({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <AppDialogProvider>
        <div className="app-shell">
          <main className="app-main">
            <div className="container">
              {children}
            </div>
          </main>
          <BottomNav />
        </div>
      </AppDialogProvider>
    </LocaleProvider>
  );
}
