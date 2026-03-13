"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppDialogProvider>
      <div className="app-shell">
        <main className="app-shell-main">
          <div className="app-browser-top-chrome" aria-hidden="true" />
          <div className="app-shell-route-frame">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </AppDialogProvider>
  );
}
