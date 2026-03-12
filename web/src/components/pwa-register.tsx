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

const UPDATE_POLL_INITIAL_DELAY_MS = 5_000;
const UPDATE_POLL_INTERVAL_MS = 15_000;
const APPLIED_BUILD_STORAGE_KEY = "workout-log:pwa-applied-build";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function syncStandaloneDocumentState(isStandalone: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-standalone-pwa", isStandalone ? "true" : "false");
}

/**
 * Measures the actual bottom safe-area gap that the browser/OS reserves.
 *
 * Two approaches in order of preference:
 *  1. CSS env(safe-area-inset-bottom) – works when viewport-fit=cover is
 *     honoured (standard behaviour).
 *  2. Geometric fallback – if env() returns 0, compare screen.height with the
 *     sum of (measured top inset + window.innerHeight) to find the gap that
 *     the OS is carving out below the viewport.  This handles iOS 26 / any
 *     engine that doesn't expose env() in standalone mode.
 *
 * The result is written to --detected-safe-area-bottom on <html> so CSS can
 * reference it as a guaranteed-non-zero value when env() fails.
 */
function measureAndInjectSafeAreaBottom() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const probe = (prop: string) => {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;top:0;left:0;height:${prop};visibility:hidden;pointer-events:none;`;
    document.documentElement.appendChild(el);
    const h = parseFloat(getComputedStyle(el).height) || 0;
    el.remove();
    return h;
  };

  const envBottom = probe("env(safe-area-inset-bottom)");

  let safeBottom = envBottom;
  if (safeBottom === 0) {
    // env() returned 0 – try geometric measurement.
    const envTop = probe("env(safe-area-inset-top)");
    const gap = window.screen.height - envTop - window.innerHeight;
    if (gap > 0) safeBottom = gap;
  }

  if (safeBottom > 0) {
    document.documentElement.style.setProperty(
      "--detected-safe-area-bottom",
      `${Math.round(safeBottom)}px`,
    );
  }

  // Ensure the html background colour matches the nav bar so the OS-rendered
  // safe-area zone (outside the CSS viewport) is seamless.
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.style.backgroundColor = isDark ? "#0d1119" : "#ffffff";
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

function getBuildIdFromServiceWorkerScriptUrl(scriptUrl: string | null | undefined) {
  if (!scriptUrl) return null;
  try {
    return new URL(scriptUrl, window.location.origin).searchParams.get("v")?.trim() ?? null;
  } catch {
    return null;
  }
}

function readAppliedBuildMarker() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(APPLIED_BUILD_STORAGE_KEY);
}

function writeAppliedBuildMarker(buildId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(APPLIED_BUILD_STORAGE_KEY, buildId);
}

function clearAppliedBuildMarker() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(APPLIED_BUILD_STORAGE_KEY);
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

async function getSettledServiceWorkerRegistration() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (registration?.active || registration?.waiting || registration?.installing) {
    return registration;
  }
  return navigator.serviceWorker.ready.catch(() => null);
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
  const targetBuildIdRef = useRef<string | null>(null);
  const recentlyAppliedBuildIdRef = useRef<string | null>(null);
  const dismissedUpdateBuildIdRef = useRef<string | null>(null);
  const observedRegistrationsRef = useRef<WeakSet<ServiceWorkerRegistration>>(new WeakSet());
  const updateCheckInFlightRef = useRef<Promise<void> | null>(null);
  const availableBuildIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(display-mode: standalone)");
    const syncMode = () => {
      const nextStandalone = isStandaloneMode();
      setIsStandalone(nextStandalone);
      syncStandaloneDocumentState(nextStandalone);
      if (nextStandalone) measureAndInjectSafeAreaBottom();
    };

    syncMode();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncMode);
    } else if (typeof media.addListener === "function") {
      media.addListener(syncMode);
    }

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", syncMode);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(syncMode);
      }
      syncStandaloneDocumentState(false);
    };
  }, []);

  const setAvailableUpdateBuild = useCallback((buildId: string | null) => {
    availableBuildIdRef.current = buildId;
    setAvailableBuildId(buildId);
  }, []);

  const setDismissedUpdateBuild = useCallback((buildId: string | null) => {
    dismissedUpdateBuildIdRef.current = buildId;
    setDismissedUpdateBuildId(buildId);
  }, []);

  const shouldIgnoreBuildId = useCallback((buildId: string | null) => {
    if (!buildId) return true;
    if (buildId === currentBuildIdRef.current) return true;
    if (buildId === recentlyAppliedBuildIdRef.current) return true;
    if (buildId === dismissedUpdateBuildIdRef.current) return true;
    return false;
  }, []);

  const observeRegistration = useCallback((registration: ServiceWorkerRegistration) => {
    if (observedRegistrationsRef.current.has(registration)) return;
    observedRegistrationsRef.current.add(registration);

    registration.addEventListener("updatefound", () => {
      const nextWorker = registration.installing;
      if (!nextWorker) return;
      nextWorker.addEventListener("statechange", () => {
        const nextBuildId = getBuildIdFromServiceWorkerScriptUrl(nextWorker.scriptURL);
        if (
          nextWorker.state === "installed" &&
          navigator.serviceWorker.controller &&
          !shouldIgnoreBuildId(nextBuildId)
        ) {
          setAvailableUpdateBuild(nextBuildId);
          setUpdateReady(true);
        }
      });
    });
  }, [setAvailableUpdateBuild, shouldIgnoreBuildId]);

  const registerServiceWorker = useCallback(async (buildId?: string) => {
    const registration = await navigator.serviceWorker.register(getServiceWorkerScriptUrl(buildId));
    observeRegistration(registration);
    const waitingBuildId = getBuildIdFromServiceWorkerScriptUrl(registration.waiting?.scriptURL);
    if (!shouldIgnoreBuildId(waitingBuildId)) {
      setAvailableUpdateBuild(waitingBuildId);
      setUpdateReady(true);
    }
    return registration;
  }, [observeRegistration, setAvailableUpdateBuild, shouldIgnoreBuildId]);

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

        const registration = await getSettledServiceWorkerRegistration();
        const activeBuildId = getBuildIdFromServiceWorkerScriptUrl(registration?.active?.scriptURL);
        const waitingBuildId = getBuildIdFromServiceWorkerScriptUrl(registration?.waiting?.scriptURL);
        if (registration) {
          observeRegistration(registration);
          if (!shouldIgnoreBuildId(waitingBuildId)) {
            setAvailableUpdateBuild(waitingBuildId);
            setUpdateReady(true);
            return;
          }
        }

        if (latestBuildId === activeBuildId && latestBuildId) {
          currentBuildIdRef.current = latestBuildId;
        }

        if (
          latestBuildId === currentBuildIdRef.current ||
          latestBuildId === activeBuildId ||
          latestBuildId === recentlyAppliedBuildIdRef.current
        ) {
          setAvailableUpdateBuild(null);
          setUpdateReady(false);
          if (
            latestBuildId &&
            recentlyAppliedBuildIdRef.current &&
            latestBuildId === recentlyAppliedBuildIdRef.current
          ) {
            clearAppliedBuildMarker();
          }
          return;
        }

        if (latestBuildId === dismissedUpdateBuildIdRef.current) return;
        setAvailableUpdateBuild(latestBuildId);
      } finally {
        setIsCheckingForUpdate(false);
        updateCheckInFlightRef.current = null;
      }
    })();

    updateCheckInFlightRef.current = run;
    await run;
  }, [disableServiceWorker, observeRegistration, setAvailableUpdateBuild, shouldIgnoreBuildId]);

  useEffect(() => {
    if (disableServiceWorker) return;
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isStandaloneMode()) return;
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      syncStandaloneDocumentState(true);
    };

    if (canUseInstallPrompt) {
      window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.addEventListener("appinstalled", onAppInstalled);
    }

    return () => {
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
    const appliedBuildId = readAppliedBuildMarker();
    if (appliedBuildId) {
      recentlyAppliedBuildIdRef.current = appliedBuildId;
      if (appliedBuildId === currentBuildIdRef.current) {
        clearAppliedBuildMarker();
      }
    }

    const onControllerChange = () => {
      if (isReloadingForUpdate.current) return;
      isReloadingForUpdate.current = true;
      if (targetBuildIdRef.current) {
        writeAppliedBuildMarker(targetBuildIdRef.current);
        recentlyAppliedBuildIdRef.current = targetBuildIdRef.current;
      }
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
    const initialUpdateTimer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      void checkForAppUpdate();
    }, UPDATE_POLL_INITIAL_DELAY_MS);

    const register = async () => {
      try {
        // Check the currently active SW build ID before registering.
        // If the page loaded with stale cached HTML after an SW update,
        // currentBuildIdRef.current holds the old build ID. Registering that
        // old URL would install a downgrade SW in "waiting" state, which then
        // bypasses shouldIgnoreBuildId (since currentBuildIdRef was already
        // updated to the new build ID) and triggers a spurious update banner loop.
        const existingRegistration = await getSettledServiceWorkerRegistration();
        const existingActiveBuildId = getBuildIdFromServiceWorkerScriptUrl(
          existingRegistration?.active?.scriptURL,
        );
        const buildIdToRegister = existingActiveBuildId ?? currentBuildIdRef.current;
        if (existingActiveBuildId) {
          currentBuildIdRef.current = existingActiveBuildId;
        }

        const registration = await registerServiceWorker(buildIdToRegister);
        await registration.update().catch(() => undefined);
        const settledRegistration = await getSettledServiceWorkerRegistration();
        const activeBuildId = getBuildIdFromServiceWorkerScriptUrl(settledRegistration?.active?.scriptURL);
        if (activeBuildId) {
          currentBuildIdRef.current = activeBuildId;
          if (
            recentlyAppliedBuildIdRef.current &&
            activeBuildId === recentlyAppliedBuildIdRef.current
          ) {
            clearAppliedBuildMarker();
            setAvailableUpdateBuild(null);
            setUpdateReady(false);
          }
        }
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
        window.clearTimeout(initialUpdateTimer);
        window.clearInterval(updateInterval);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("online", onOnline);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }

    return () => {
      window.clearTimeout(initialUpdateTimer);
      window.clearInterval(updateInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [checkForAppUpdate, disableServiceWorker, registerServiceWorker, setAvailableUpdateBuild]);

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
    setDismissedUpdateBuild(null);
    setIsCheckingForUpdate(true);
    try {
      const registration = await getSettledServiceWorkerRegistration();
      if (registration) {
        observeRegistration(registration);
        const waitingBuildId = getBuildIdFromServiceWorkerScriptUrl(registration.waiting?.scriptURL);
        if (registration.waiting && waitingBuildId && !shouldIgnoreBuildId(waitingBuildId)) {
          targetBuildIdRef.current = waitingBuildId;
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        }
      }

      const targetBuildId = availableBuildIdRef.current;
      if (!targetBuildId) return;
      targetBuildIdRef.current = targetBuildId;
      const nextRegistration = await registerServiceWorker(targetBuildId);
      await nextRegistration.update().catch(() => undefined);
      if (nextRegistration.waiting) {
        nextRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    } finally {
      setIsCheckingForUpdate(false);
    }
  }

  function dismissDetectedUpdate() {
    if (availableBuildIdRef.current) {
      setDismissedUpdateBuild(availableBuildIdRef.current);
    }
    setAvailableUpdateBuild(null);
    setUpdateReady(false);
  }

  const showDetectedUpdateBanner =
    Boolean(availableBuildId) && dismissedUpdateBuildId !== availableBuildId;
  const showUpdateReadyBanner = updateReady;

  if (!showUpdateReadyBanner && (isStandalone || !deferredPrompt) && !showDetectedUpdateBanner) {
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
      {showDetectedUpdateBanner && !showUpdateReadyBanner && (
        <div className="app-pwa-banner is-stacked">
          <span className="app-pwa-text">
            새 버전을 찾았습니다.
            <br />
            지금 업데이트할 수 있어요.
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
      {showUpdateReadyBanner && (
        <div className="app-pwa-banner is-stacked">
          <span className="app-pwa-text">
            새 버전이 준비됐습니다.
            <br />
            업데이트하면 바로 반영됩니다.
          </span>
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
