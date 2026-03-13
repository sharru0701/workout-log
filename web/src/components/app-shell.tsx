"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppDialogProvider>
      <div className="app-shell">
        <div className="app-status-bar-shield" aria-hidden="true" />
        <main className="app-shell-main">
          <div className="app-shell-route-frame">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </AppDialogProvider>
  );
}
