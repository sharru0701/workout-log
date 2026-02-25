import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { SyncStatusTray } from "@/components/sync-status-tray";
import { TopBackButton } from "@/components/top-back-button";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <main className="app-shell-main">
        <TopBackButton />
        {children}
      </main>
      <SyncStatusTray />
      <BottomNav />
    </div>
  );
}
