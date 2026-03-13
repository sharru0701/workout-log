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
  // Use the actual page background colors so Safari's address bar chrome
  // visually blends with the page top (seamless "transparent" effect).
  // "transparent" as a value is unreliable across Safari versions and often
  // falls back to an opaque white/grey bar instead of sampling the page.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b121c" },
    { media: "(prefers-color-scheme: light)", color: "#f3f6fb" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${appSans.variable} ${appMono.variable} antialiased`}>
        <AppLaunchSplash />
        <ThemePreferenceSync />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
