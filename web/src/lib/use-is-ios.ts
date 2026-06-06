"use client";

import { useEffect, useState } from "react";

/**
 * iOS(아이폰/아이패드/아이팟) 디바이스 여부를 감지한다.
 * iOS에서는 모든 브라우저가 WebKit(Safari 엔진)을 사용하므로 디바이스 판별만으로
 * 네이티브 날짜 휠픽커(`<input type="month">` 등) 동작이 보장된다.
 */
export function detectIsIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iP(hone|od|ad)/.test(ua)) return true;
  // iPadOS 13+ 는 데스크톱 Mac UA로 위장하므로 터치 포인트로 추가 판별한다.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * SSR/하이드레이션 불일치를 피하기 위해 마운트 이후에만 true가 될 수 있는 iOS 감지 훅.
 * 첫 렌더는 항상 false → 하이드레이션 후 iOS면 true.
 */
export function useIsIos(): boolean {
  const [isIos, setIsIos] = useState(false);
  useEffect(() => {
    setIsIos(detectIsIos());
  }, []);
  return isIos;
}
