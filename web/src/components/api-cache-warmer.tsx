"use client";

import { useEffect } from "react";
import { warmApiCacheFromIDB } from "@/shared/api/api";

/**
 * 앱 마운트 시 IndexedDB에 저장된 API 캐시를 인메모리로 복원.
 * 렌더 결과 없음 — 오직 사이드 이펙트(워밍)만 수행.
 */
export function ApiCacheWarmer() {
  useEffect(() => {
    void warmApiCacheFromIDB();
  }, []);
  return null;
}
