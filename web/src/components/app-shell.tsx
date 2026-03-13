"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppDialogProvider>
      <div className="app-shell app-root-canvas">
        <main className="app-shell-main">
          {children}
        </main>
        <BottomNav />
      </div>
    </AppDialogProvider>
  );
}
