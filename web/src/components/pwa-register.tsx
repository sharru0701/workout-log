"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NextDataWindow = Window & {
  __NEXT_DATA__?: {
    buildId?: string;
  };
};

type VersionPayload = {
  buildId?: string;
  version?: string;
  serviceWorkerUrl?: string;
  ts?: string;
};

const UPDATE_POLL_INTERVAL_MS = 60_000;

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafariBrowser() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isIos && isSafari;
}

function getBuildIdFromScripts() {
  if (typeof document === "undefined") return null;
  const scripts = document.querySelectorAll("script[src]");
  for (const script of scripts) {
    const src = script.getAttribute("src");
    if (!src) continue;
    const match = src.match(/\/_next\/static\/([^/]+)\//);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getCurrentBuildId() {
  if (typeof window === "undefined") return "dev";
  const nextData = (window as NextDataWindow).__NEXT_DATA__;
  return nextData?.buildId ?? getBuildIdFromScripts() ?? "dev";
}

function getServiceWorkerScriptUrl(buildId?: string) {
  const resolvedBuildId = buildId?.trim() || getCurrentBuildId();
  return `/sw.js?v=${encodeURIComponent(resolvedBuildId)}`;
}

async function fetchLatestVersion() {
  const response = await fetch("/api/version", {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
    },
  }).catch(() => null);

  if (!response?.ok) return null;
  return (await response.json().catch(() => null)) as VersionPayload | null;
}

export function PwaRegister() {
  const disableServiceWorker = process.env.NEXT_PUBLIC_DISABLE_SW === "1";
  const canUseInstallPrompt = process.env.NODE_ENV === "production";
  const canShowIosInstallHint = !disableServiceWorker && canUseInstallPrompt && isIosSafariBrowser();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [availableBuildId, setAvailableBuildId] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissedIosHint, setDismissedIosHint] = useState(false);
  const [dismissedUpdateBuildId, setDismissedUpdateBuildId] = useState<string | null>(null);
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
  const isReloadingForUpdate = useRef(false);
  const currentBuildIdRef = useRef("dev");
  const observedRegistrationsRef = useRef<WeakSet<ServiceWorkerRegistration>>(new WeakSet());
  const updateCheckInFlightRef = useRef<Promise<void> | null>(null);

  const observeRegistration = useCallback((registration: ServiceWorkerRegistration) => {
    if (observedRegistrationsRef.current.has(registration)) return;
    observedRegistrationsRef.current.add(registration);

    registration.addEventListener("updatefound", () => {
      const nextWorker = registration.installing;
      if (!nextWorker) return;
      nextWorker.addEventListener("statechange", () => {
        if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      });
    });
  }, []);

  const registerServiceWorker = useCallback(async (buildId?: string) => {
    const registration = await navigator.serviceWorker.register(getServiceWorkerScriptUrl(buildId));
    observeRegistration(registration);
    if (registration.waiting) setUpdateReady(true);
    return registration;
  }, [observeRegistration]);

  const checkForAppUpdate = useCallback(async () => {
    if (disableServiceWorker) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    if (updateCheckInFlightRef.current) {
      await updateCheckInFlightRef.current;
      return;
    }

    const run = (async () => {
      setIsCheckingForUpdate(true);
      try {
        const latestVersion = await fetchLatestVersion();
        const latestBuildId = String(latestVersion?.buildId ?? "").trim();
        if (!latestBuildId) return;

        const updateWasDismissed = dismissedUpdateBuildId === latestBuildId;
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          observeRegistration(registration);
          if (registration.waiting) {
            if (!updateWasDismissed) {
              setAvailableBuildId(
                latestBuildId !== currentBuildIdRef.current ? latestBuildId : availableBuildId,
              );
              setUpdateReady(true);
            }
            return;
          }
        }

        if (latestBuildId === currentBuildIdRef.current) {
          setAvailableBuildId(null);
          setUpdateReady(false);
          return;
        }

        if (updateWasDismissed) return;
        setAvailableBuildId(latestBuildId);
      } finally {
        setIsCheckingForUpdate(false);
        updateCheckInFlightRef.current = null;
      }
    })();

    updateCheckInFlightRef.current = run;
    await run;
  }, [availableBuildId, disableServiceWorker, dismissedUpdateBuildId, observeRegistration]);

  useEffect(() => {
    if (disableServiceWorker) return;
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(display-mode: standalone)");
    const syncMode = () => setIsStandalone(isStandaloneMode());
    syncMode();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncMode);
    } else if (typeof media.addListener === "function") {
      media.addListener(syncMode);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isStandaloneMode()) return;
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    if (canUseInstallPrompt) {
      window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.addEventListener("appinstalled", onAppInstalled);
    }

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", syncMode);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(syncMode);
      }
      if (canUseInstallPrompt) {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.removeEventListener("appinstalled", onAppInstalled);
      }
    };
  }, [disableServiceWorker, canUseInstallPrompt]);

  useEffect(() => {
    if (disableServiceWorker) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      const cleanupDevServiceWorker = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      };
      void cleanupDevServiceWorker();
      return;
    }

    currentBuildIdRef.current = getCurrentBuildId();

    const onControllerChange = () => {
      if (isReloadingForUpdate.current) return;
      isReloadingForUpdate.current = true;
      window.location.reload();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void checkForAppUpdate();
    };

    const onFocus = () => {
      void checkForAppUpdate();
    };

    const onOnline = () => {
      void checkForAppUpdate();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    const updateInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void checkForAppUpdate();
    }, UPDATE_POLL_INTERVAL_MS);

    const register = async () => {
      try {
        const registration = await registerServiceWorker(currentBuildIdRef.current);
        await registration.update().catch(() => undefined);
        void checkForAppUpdate();
      } catch {
        // Fail silently; app should still function without offline support.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      const onLoad = () => {
        void register();
      };
      window.addEventListener("load", onLoad, { once: true });
      return () => {
        window.removeEventListener("load", onLoad);
        window.clearInterval(updateInterval);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("online", onOnline);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }

    return () => {
      window.clearInterval(updateInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [checkForAppUpdate, disableServiceWorker, registerServiceWorker]);

  if (disableServiceWorker) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  async function handleUpdateNow() {
    if (!("serviceWorker" in navigator)) return;
    setDismissedUpdateBuildId(null);
    setIsCheckingForUpdate(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        observeRegistration(registration);
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        }
      }

      const nextRegistration = await registerServiceWorker(availableBuildId ?? undefined);
      await nextRegistration.update().catch(() => undefined);
      if (nextRegistration.waiting) {
        nextRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    } finally {
      setIsCheckingForUpdate(false);
    }
  }

  function dismissDetectedUpdate() {
    if (availableBuildId) {
      setDismissedUpdateBuildId(availableBuildId);
    }
    setAvailableBuildId(null);
    setUpdateReady(false);
  }

  const showDetectedUpdateBanner =
    Boolean(availableBuildId) && dismissedUpdateBuildId !== availableBuildId;

  if ((isStandalone || !deferredPrompt) && !updateReady && !showDetectedUpdateBanner) {
    if (!canShowIosInstallHint || isStandalone || dismissedIosHint) return null;
  }

  return (
    <div className="app-pwa-stack" aria-live="polite">
      {canShowIosInstallHint && !isStandalone && !deferredPrompt && !dismissedIosHint && (
        <div className="app-pwa-banner">
          <span className="app-pwa-text">Safari에서는 공유 메뉴에서 홈 화면에 추가를 선택하세요.</span>
          <div className="app-pwa-actions">
            <button className="app-pwa-button is-subtle" onClick={() => setDismissedIosHint(true)}>
              닫기
            </button>
          </div>
        </div>
      )}
      {!isStandalone && deferredPrompt && (
        <div className="app-pwa-banner">
          <span className="app-pwa-text">Install app for home-screen workout logging.</span>
          <div className="app-pwa-actions">
            <button className="app-pwa-button" onClick={() => void handleInstall()}>
              Install
            </button>
            <button className="app-pwa-button is-subtle" onClick={() => setDeferredPrompt(null)}>
              Not now
            </button>
          </div>
        </div>
      )}
      {showDetectedUpdateBanner && !updateReady && (
        <div className="app-pwa-banner">
          <span className="app-pwa-text">
            새 배포를 확인했습니다. 업데이트를 누르면 최신 변경사항을 바로 반영합니다.
          </span>
          <div className="app-pwa-actions">
            <button className="app-pwa-button" onClick={() => void handleUpdateNow()} disabled={isCheckingForUpdate}>
              {isCheckingForUpdate ? "준비 중" : "업데이트"}
            </button>
            <button className="app-pwa-button is-subtle" onClick={dismissDetectedUpdate}>
              나중에
            </button>
          </div>
        </div>
      )}
      {updateReady && (
        <div className="app-pwa-banner">
          <span className="app-pwa-text">새 버전이 준비되었습니다. 업데이트를 누르면 최신 화면으로 전환합니다.</span>
          <div className="app-pwa-actions">
            <button className="app-pwa-button" onClick={() => void handleUpdateNow()} disabled={isCheckingForUpdate}>
              {isCheckingForUpdate ? "반영 중" : "업데이트"}
            </button>
            <button className="app-pwa-button is-subtle" onClick={dismissDetectedUpdate}>
              나중에
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
