"use client";

import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NextDataWindow = Window & {
  __NEXT_DATA__?: {
    buildId?: string;
  };
};

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

function getServiceWorkerScriptUrl() {
  if (typeof window === "undefined") return "/sw.js?v=dev";
  const nextData = (window as NextDataWindow).__NEXT_DATA__;
  const buildId = nextData?.buildId ?? getBuildIdFromScripts() ?? "dev";
  return `/sw.js?v=${encodeURIComponent(buildId)}`;
}

export function PwaRegister() {
  const disableServiceWorker = process.env.NEXT_PUBLIC_DISABLE_SW === "1";
  const canUseInstallPrompt = process.env.NODE_ENV === "production";
  const canShowIosInstallHint = !disableServiceWorker && canUseInstallPrompt && isIosSafariBrowser();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissedIosHint, setDismissedIosHint] = useState(false);
  const isReloadingForUpdate = useRef(false);

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

    const onControllerChange = () => {
      if (isReloadingForUpdate.current) return;
      isReloadingForUpdate.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(getServiceWorkerScriptUrl());
        if (registration.waiting) setUpdateReady(true);

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;
          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
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
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, [disableServiceWorker]);

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
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.waiting) {
      await registration?.update();
      return;
    }
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  if ((isStandalone || !deferredPrompt) && !updateReady) {
    if (!canShowIosInstallHint || isStandalone || dismissedIosHint) return null;
  }

  return (
    <div className="app-pwa-stack" aria-live="polite">
      {canShowIosInstallHint && !isStandalone && !deferredPrompt && !dismissedIosHint && (
        <div className="app-pwa-banner">
          <span className="app-pwa-text">In Safari: Share menu → Add to Home Screen.</span>
          <div className="app-pwa-actions">
            <button className="app-pwa-button is-subtle" onClick={() => setDismissedIosHint(true)}>
              Dismiss
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
      {updateReady && (
        <div className="app-pwa-banner">
          <span className="app-pwa-text">New version ready.</span>
          <div className="app-pwa-actions">
            <button className="app-pwa-button" onClick={() => void handleUpdateNow()}>
              Update
            </button>
            <button className="app-pwa-button is-subtle" onClick={() => setUpdateReady(false)}>
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
