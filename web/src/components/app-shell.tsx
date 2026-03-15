"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
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
  );
}
