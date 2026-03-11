"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { SyncStatusTray } from "@/components/sync-status-tray";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppDialogProvider>
      <div className="app-shell">
        <main className="app-shell-main">
          <div className="app-shell-route-frame">
            {children}
          </div>
        </main>
        <SyncStatusTray />
        <BottomNav />
      </div>
    </AppDialogProvider>
  );
}
