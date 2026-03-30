import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Inter, Space_Grotesk } from "next/font/google";
import "@/styles/index.css";
import "@/styles/components/bottom-sheet.css";
import { AppShell } from "@/components/app-shell";
import { AppLaunchSplash } from "@/components/app-launch-splash";
import { ThemePreferenceSync } from "@/components/theme-preference-sync";
import { LocalePreferenceSync } from "@/components/locale-preference-sync";
import { PwaRegister } from "@/components/pwa-register";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OfflineQueueFlush } from "@/components/offline-queue-flush";
import {
  LOCALE_COOKIE_NAME,
  coerceAppLocale,
  parseAcceptLanguage,
  type AppLocale,
} from "@/lib/i18n/messages";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // black-translucent: transparent status bar in standalone mode.
    // Safe because viewportFit=cover + safe-area-inset padding is already in place.
    statusBarStyle: "black-translucent",
    title: "Workout Log",
  },
  icons: {
    // apple-touch-icon: used by iOS when adding to home screen.
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
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
    <html lang={initialLocale} suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        {/* Material Symbols Outlined — variable icon font used across all screens */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body>
        <AppLaunchSplash />
        <AppShell initialLocale={initialLocale}>
          <ThemePreferenceSync />
          <LocalePreferenceSync />
          {children}
        </AppShell>
        <OfflineIndicator />
        <OfflineQueueFlush />
        <PwaInstallPrompt />
        <PwaRegister />
      </body>
    </html>
  );
}
