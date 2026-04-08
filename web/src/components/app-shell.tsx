"use client";

import { useEffect, type ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { AppDialogProvider } from "@/shared/ui/app-dialog-provider";
import { ApiCacheWarmer } from "@/components/api-cache-warmer";
import type { AppLocale } from "@/lib/i18n/messages";
import { useRouter } from "next/navigation";

/**
 * AppShell Component
 * PERF: Added View Transitions API support for native-like page transitions.
 * Wraps global providers and manages the main layout structure.
 */
export function AppShell({
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const router = useRouter();

  // PERF: View Transitions API Integration
  // Automatically applies smooth transitions when navigating between pages
  useEffect(() => {
    if (!("startViewTransition" in document)) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (
        !target || 
        target.origin !== window.location.origin || 
        target.hasAttribute("download") ||
        target.target === "_blank" ||
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
      ) return;

      e.preventDefault();
      const href = target.getAttribute("href");
      if (!href) return;

      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (document as any).startViewTransition(() => {
          router.push(href);
        });
      } else {
        router.push(href);
      }
    };

    window.addEventListener("click", handleLinkClick);
    return () => window.removeEventListener("click", handleLinkClick);
  }, [router]);

  return (
    <AppDialogProvider>
      <ApiCacheWarmer />
      <div className="app-shell flex flex-col min-h-screen bg-surface-base text-text">
        <main className="app-main flex-1 flex flex-col overflow-x-hidden">
          <div className="container max-w-lg mx-auto w-full flex-1 flex flex-col">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </AppDialogProvider>
  );
}

