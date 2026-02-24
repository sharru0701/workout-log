import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { viewportThemeColor } from "@/lib/theme";

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Workout Log",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: viewportThemeColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${appSans.variable} ${appMono.variable} antialiased`}>
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
