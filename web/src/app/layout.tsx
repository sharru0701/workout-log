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
  // Must match html { background } in globals.css AND --color-fill-base.
  // The final resolved --bg-primary (after all :root cascade) is:
  //   dark  → #000000  (--color-fill-base dark, line ~4682)
  //   light → #f2f2f7  (--color-fill-base light, line ~4745)
  // Mismatching here causes Safari's status bar chrome to show a different
  // shade from the page top, breaking the seamless blend.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
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
          Theme-color overrides match THEME_COLOR_OVERRIDE in workout-preferences.ts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var raw=localStorage.getItem("workout-log.setting.v1.prefs.theme.mode");
var v=raw?JSON.parse(raw).value:null;
var t=(v==="LIGHT"||v==="DARK"||v==="SYSTEM")?v:"SYSTEM";
document.documentElement.setAttribute("data-theme-preference",t.toLowerCase());
var cm={"LIGHT":"#f2f2f7","DARK":"#000000"};
var c=cm[t];
if(c){var m=document.createElement("meta");m.name="theme-color";m.content=c;m.dataset.dynamic="true";document.head.appendChild(m);}
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
