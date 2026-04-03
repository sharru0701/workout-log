import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Inter } from "next/font/google";
import "@/styles/index.css";
import "@/styles/components/bottom-sheet.css";
import { AppShell } from "@/components/app-shell";
import { AppLaunchSplash } from "@/components/app-launch-splash";
import { ThemePreferenceSync } from "@/components/theme-preference-sync";
import { LocalePreferenceSync } from "@/components/locale-preference-sync";
import { TimezonePreferenceSync } from "@/components/timezone-preference-sync";
import { LocaleProvider } from "@/components/locale-provider";
import { FontStylesheetLoader } from "@/components/font-stylesheet-loader";

import {
  LOCALE_COOKIE_NAME,
  coerceAppLocale,
  parseAcceptLanguage,
  type AppLocale,
} from "@/lib/i18n/messages";

// Inter Variable Font — wght 100–900 전 범위 지원
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const EARLY_THEME_BOOTSTRAP = `
(() => {
  try {
    const storageKey = "workout-log.setting.v1.prefs.theme.mode";
    const raw = window.localStorage.getItem(storageKey);
    let preference = "system";

    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = String(parsed?.value ?? "").trim().toLowerCase();
      if (normalized === "light" || normalized === "dark" || normalized === "system") {
        preference = normalized;
      }
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedDark = preference === "dark" || (preference !== "light" && prefersDark);
    const backgroundColor = resolvedDark ? "#10141a" : "#fdf6e3";

    document.documentElement.setAttribute("data-theme-preference", preference);
    document.documentElement.style.backgroundColor = backgroundColor;
    document.body.style.backgroundColor = backgroundColor;
  } catch {}
})();
`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1, // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
  viewportFit: "cover", // [수정됨] 상태바 배경 애니메이션 딜레이 및 주소창 대응
  // No themeColor here: let Safari use its natural frosted-glass effect.
  // In standalone mode (iOS home screen), apple-mobile-web-app-status-bar-style
  // controls the status bar instead — see appleWebApp below.
};

export const metadata: Metadata = {
  title: "Workout Log",
  description: "Workout tracking",
};

async function resolveInitialLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) {
    return coerceAppLocale(cookieLocale);
  }

  const requestHeaders = await headers();
  return parseAcceptLanguage(requestHeaders.get("accept-language"));
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await resolveInitialLocale();

  return (
    <html lang={initialLocale} suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_THEME_BOOTSTRAP }} />
        {/* DNS + TCP 핸드셰이크 선점 — FontStylesheetLoader가 삽입하기 전에 미리 연결 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        {/*
          Pretendard + Material Symbols는 FontStylesheetLoader (useEffect)로 비블로킹 로드.
          <link rel="stylesheet">를 여기에 두면 렌더 블로킹 → FCP 200-400ms 지연.
          비블로킹으로 전환하면 시스템 폰트로 즉시 렌더 후 swap.
        */}
      </head>
      <body>
        <FontStylesheetLoader />
        <LocaleProvider initialLocale={initialLocale}>
          <AppLaunchSplash />
          <AppShell initialLocale={initialLocale}>
            <ThemePreferenceSync />
            <LocalePreferenceSync />
            <TimezonePreferenceSync />
            {children}
          </AppShell>

        </LocaleProvider>
      </body>
    </html>
  );
}
