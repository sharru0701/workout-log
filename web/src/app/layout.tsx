import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AppLaunchSplash } from "@/components/app-launch-splash";
import { ThemePreferenceSync } from "@/components/theme-preference-sync";

const appSans = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const appMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Workout Log",
  description: "Workout tracking",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workout Log",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // iOS Safari (including iOS 26) supports transparent browser chrome when
  // theme-color is transparent with viewport-fit=cover.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "transparent" },
    { media: "(prefers-color-scheme: light)", color: "transparent" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Apply theme preference BEFORE first paint so Safari reads the correct
          color-scheme (and thus sets the status-bar tint) on initial load.
          Without this, html has no data-theme-preference at SSR time, so
          color-scheme defaults to "dark light" (dark-first) and Safari locks
          in a dark status bar even when the user chose the light theme.

          Key:  workout-log.setting.v1.prefs.theme.mode  → JSON { value: "LIGHT"|"DARK"|"SYSTEM" }
          Matches: LOCAL_STORAGE_SETTING_PREFIX + SETTINGS_KEYS.theme in workout-preferences.ts
          Theme-color stays transparent so Safari top/bottom browser chrome
          remains translucent regardless of theme preference.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var raw=localStorage.getItem("workout-log.setting.v1.prefs.theme.mode");
var v=raw?JSON.parse(raw).value:null;
var t=(v==="LIGHT"||v==="DARK"||v==="SYSTEM")?v:"SYSTEM";
document.documentElement.setAttribute("data-theme-preference",t.toLowerCase());
var m=document.createElement("meta");m.name="theme-color";m.content="transparent";m.dataset.dynamic="true";document.head.appendChild(m);
}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${appSans.variable} ${appMono.variable} antialiased`}>
        <AppLaunchSplash />
        <ThemePreferenceSync />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
