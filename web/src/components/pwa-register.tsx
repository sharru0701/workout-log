"use client";

import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
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

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const [dismissedIosHint, setDismissedIosHint] = useState(false);
  const isReloadingForUpdate = useRef(false);

  useEffect(() => {
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

    setShowIosInstallHint(isIosSafariBrowser());

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", syncMode);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(syncMode);
      }
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => {
      if (isReloadingForUpdate.current) return;
      isReloadingForUpdate.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
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
  }, []);

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
    if (!showIosInstallHint || isStandalone || dismissedIosHint) return null;
  }

  return (
    <div className="app-pwa-stack" aria-live="polite">
      {showIosInstallHint && !isStandalone && !deferredPrompt && !dismissedIosHint && (
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
