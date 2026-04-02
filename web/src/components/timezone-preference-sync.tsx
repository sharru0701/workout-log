"use client";

import { useEffect } from "react";

export function TimezonePreferenceSync() {
  useEffect(() => {
    // 클라이언트의 실제 timezone을 감지하여 쿠키에 저장 (서버 렌더링 시 참고용)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      document.cookie = `timezone=${encodeURIComponent(timezone)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);

  return null;
}
