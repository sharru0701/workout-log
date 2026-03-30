"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

const SW_INSTALLED_KEY = "sw-installed";

/**
 * 서비스 워커를 등록하고, 새 버전이 활성화되면 업데이트 토스트를 표시.
 *
 * SW 업데이트 흐름:
 *  1. 새 sw.js가 감지되면 install → skipWaiting() 호출로 즉시 activate
 *  2. 기존 페이지의 controller가 교체 → controllerchange 이벤트
 *  3. 토스트 표시: "앱이 업데이트되었어요" + 새로고침 버튼
 *
 * 최초 설치에서는 토스트를 표시하지 않음.
 *
 * iOS Safari PWA에서는 앱을 열 때 navigator.serviceWorker.controller가
 * null로 시작하는 경우가 있어 prevController 방식이 신뢰할 수 없음.
 * localStorage 플래그로 최초 설치 여부를 판단.
 */
export function PwaRegister() {
  const { locale } = useLocale();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // iOS Safari PWA에서는 controller가 null로 시작할 수 있으므로
    // localStorage로 "이미 설치된 적 있는지" 판단
    const wasInstalled = localStorage.getItem(SW_INSTALLED_KEY) === "true";
    let registration: ServiceWorkerRegistration | null = null;

    const handleControllerChange = () => {
      if (wasInstalled) {
        setUpdateAvailable(true);
      } else {
        // 최초 설치 완료 — 다음 controllerchange부터 업데이트로 처리
        localStorage.setItem(SW_INSTALLED_KEY, "true");
      }
    };

    // visibilitychange: 앱 복귀 시 새 SW가 대기 중인지 확인
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && registration) {
        registration.update().catch(() => {});
      }
    };

    const register = async () => {
      // controllerchange 리스너를 register() 이전에 등록:
      // iOS PWA에서는 skipWaiting()이 즉시 실행되어 register() await 중에
      // controllerchange가 발생할 수 있으므로, 먼저 등록해야 이벤트를 놓치지 않음
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      try {
        registration = await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.debug("[PWA] Service worker registration failed:", err);
        return;
      }

      // 리스너 등록 전에 이미 대기 중인 SW가 있는 경우 대비
      // (register() 완료 시점에 이미 waiting 상태면 controllerchange를 놓쳤을 수 있음)
      if (registration.waiting && wasInstalled) {
        setUpdateAvailable(true);
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", () => void register(), { once: true });
    }

    return () => {
      // register()가 실패한 경우에도 리스너가 등록됐을 수 있으므로 항상 제거
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="sw-update-toast" role="status" aria-live="polite">
      <span className="sw-update-toast__text">{locale === "ko" ? "앱이 업데이트되었어요" : "The app has been updated"}</span>
      <button
        className="sw-update-toast__reload"
        onClick={() => window.location.reload()}
      >
        {locale === "ko" ? "새로고침" : "Reload"}
      </button>
      <button
        className="sw-update-toast__dismiss"
        onClick={() => setUpdateAvailable(false)}
        aria-label={locale === "ko" ? "닫기" : "Close"}
      >
        ✕
      </button>
    </div>
  );
}
