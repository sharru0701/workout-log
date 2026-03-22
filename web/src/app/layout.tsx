import type { Metadata, Viewport } from "next";
import "@/styles/index.css";
import "@/styles/components/bottom-sheet.css";
import { AppShell } from "@/components/app-shell";
import { AppLaunchSplash } from "@/components/app-launch-splash";
import { ThemePreferenceSync } from "@/components/theme-preference-sync";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // [수정됨] 사파리 주소창 대응
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6e3" }, // [수정됨] 사파리 주소창 대응: 라이트 테마 크림색
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },  // [수정됨] 사파리 주소창 대응: 다크 테마 배경색
  ],
};

export const metadata: Metadata = {
  title: "Workout Log",
  description: "Workout tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppLaunchSplash />
        <ThemePreferenceSync />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
