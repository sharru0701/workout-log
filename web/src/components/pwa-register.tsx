"use client";

import { useEffect, useState } from "react";

/**
 * 서비스 워커를 등록하고, 새 버전이 활성화되면 업데이트 토스트를 표시.
 *
 * SW 업데이트 흐름:
 *  1. 새 sw.js가 감지되면 install → skipWaiting() 호출로 즉시 activate
 *  2. 기존 페이지의 controller가 교체 → controllerchange 이벤트
 *  3. 토스트 표시: "앱이 업데이트되었어요" + 새로고침 버튼
 *
 * 최초 설치(이전 controller 없음)에서는 토스트를 표시하지 않음.
 */
export function PwaRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.debug("[PWA] Service worker registration failed:", err);
        return;
      }

      // controllerchange: 새 SW가 이 페이지를 제어하기 시작했음을 의미
      // prevController가 null이면 최초 설치 → 토스트 불필요
      const prevController = navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (prevController) {
          setUpdateAvailable(true);
        }
      });
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", () => void register(), { once: true });
    }
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="sw-update-toast" role="status" aria-live="polite">
      <span className="sw-update-toast__text">앱이 업데이트되었어요</span>
      <button
        className="sw-update-toast__reload"
        onClick={() => window.location.reload()}
      >
        새로고침
      </button>
      <button
        className="sw-update-toast__dismiss"
        onClick={() => setUpdateAvailable(false)}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
