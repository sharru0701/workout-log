"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const ANDROID_DISMISSED_KEY = "pwa-install-dismissed";
const IOS_HINT_DISMISSED_KEY = "pwa-ios-hint-dismissed";

function isInStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (("standalone" in window.navigator) &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) &&
    /safari/i.test(ua) &&
    !/crios|fxios|opios|EdgiOS/i.test(ua)
  );
}

/**
 * Provides install guidance for both platforms:
 * - Android/Chrome: captures `beforeinstallprompt` and shows a subtle bottom banner.
 * - iOS Safari: shows a one-time hint about Safari's "Add to Home Screen" flow.
 *
 * Both prompts are permanently dismissible (stored in localStorage).
 * Neither appears when the app is already running in standalone mode.
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const iosTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isInStandalone()) return;

    // Android / Chrome desktop: capture the native install prompt.
    if (!localStorage.getItem(ANDROID_DISMISSED_KEY)) {
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        clearTimeout(iosTimer.current);
      };
    }

    // iOS Safari: show a one-time hint after a short delay (not during initial paint).
    if (isIOSSafari() && !localStorage.getItem(IOS_HINT_DISMISSED_KEY)) {
      iosTimer.current = setTimeout(() => setShowIOSHint(true), 4000);
    }

    return () => clearTimeout(iosTimer.current);
  }, []);

  const dismissAndroid = () => {
    localStorage.setItem(ANDROID_DISMISSED_KEY, "1");
    setDeferredPrompt(null);
  };

  const dismissIOS = () => {
    localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1");
    setShowIOSHint(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    dismissAndroid();
  };

  if (deferredPrompt) {
    return (
      <div className="pwa-install-banner" role="complementary" aria-label="앱 설치 안내">
        <div className="pwa-install-banner__content">
          <span className="pwa-install-banner__text">
            홈 화면에 추가하면 더 빠르게 실행돼요
          </span>
          <div className="pwa-install-banner__actions">
            <button className="pwa-install-banner__install" onClick={handleAndroidInstall}>
              설치
            </button>
            <button
              className="pwa-install-banner__dismiss"
              onClick={dismissAndroid}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showIOSHint) {
    return (
      <div className="pwa-install-banner" role="complementary" aria-label="iOS 홈 화면 추가 안내">
        <div className="pwa-install-banner__content">
          <span className="pwa-install-banner__text">
            Safari 하단의 공유 버튼{" "}
            <ShareIcon />{" "}
            을 탭한 후 &ldquo;홈 화면에 추가&rdquo;를 선택하면 앱처럼 사용할 수 있어요
          </span>
          <button
            className="pwa-install-banner__dismiss"
            onClick={dismissIOS}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "inline", verticalAlign: "-2px" }}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
