"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

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
  const { locale } = useLocale();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (isInStandalone()) return;

    const cleanups: Array<() => void> = [];

    // Android / Chrome desktop: capture the native install prompt.
    // beforeinstallprompt is never fired on iOS, so this branch is harmless there.
    if (!localStorage.getItem(ANDROID_DISMISSED_KEY)) {
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      cleanups.push(() =>
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
      );
    }

    // iOS Safari: show a one-time hint after a short delay (not during initial paint).
    // Previously unreachable because the Android branch returned early.
    if (isIOSSafari() && !localStorage.getItem(IOS_HINT_DISMISSED_KEY)) {
      const timer = setTimeout(() => setShowIOSHint(true), 4000);
      cleanups.push(() => clearTimeout(timer));
    }

    return () => cleanups.forEach((fn) => fn());
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
      <div className="pwa-install-banner" role="complementary" aria-label={locale === "ko" ? "앱 설치 안내" : "App install prompt"}>
        <div className="pwa-install-banner__content">
          <span className="pwa-install-banner__text">
            {locale === "ko" ? "홈 화면에 추가하면 더 빠르게 실행돼요" : "Add it to your home screen for faster access"}
          </span>
          <div className="pwa-install-banner__actions">
            <button className="pwa-install-banner__install" onClick={handleAndroidInstall}>
              {locale === "ko" ? "설치" : "Install"}
            </button>
            <button
              className="pwa-install-banner__dismiss"
              onClick={dismissAndroid}
              aria-label={locale === "ko" ? "닫기" : "Close"}
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
      <div className="pwa-install-banner" role="complementary" aria-label={locale === "ko" ? "iOS 홈 화면 추가 안내" : "iOS add to home screen prompt"}>
        <div className="pwa-install-banner__content">
          <span className="pwa-install-banner__text">
            {locale === "ko" ? (
              <>
                Safari 하단의 공유 버튼 <ShareIcon /> 을 탭한 후 &ldquo;홈 화면에 추가&rdquo;를 선택하면 앱처럼 사용할 수 있어요
              </>
            ) : (
              <>
                Tap Safari&apos;s Share button <ShareIcon /> and choose &ldquo;Add to Home Screen&rdquo; to launch this like an app
              </>
            )}
          </span>
          <button
            className="pwa-install-banner__dismiss"
            onClick={dismissIOS}
            aria-label={locale === "ko" ? "닫기" : "Close"}
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
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14, fontVariationSettings: "'wght' 400", display: "inline", verticalAlign: "-2px" }}>ios_share</span>;
}
