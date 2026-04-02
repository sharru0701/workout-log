"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";
import { ApiCacheWarmer } from "@/components/api-cache-warmer";
import type { AppLocale } from "@/lib/i18n/messages";

export function AppShell({
  initialLocale: _initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  return (
    <AppDialogProvider>
      <ApiCacheWarmer />
      <div className="app-shell">
        <main className="app-main">
          <div className="container">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </AppDialogProvider>
  );
}
