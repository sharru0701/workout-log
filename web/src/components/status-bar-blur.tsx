"use client";

import { useEffect, useState } from "react";

/**
 * PWA standalone 모드에서 상태바 영역에 frosted glass 효과를 적용.
 *
 * apple-mobile-web-app-status-bar-style: black-translucent 이면
 * 상태바가 완전 투명해서 앱 배경색이 그대로 비침.
 * 이 컴포넌트는 그 위에 blur + 반투명 배경 오버레이를 씌워
 * iOS 네이티브와 유사한 frosted glass 느낌을 구현.
 *
 * - 브라우저 모드: 렌더링 안 함 (브라우저 크롬이 상태바 처리)
 * - standalone 모드: env(safe-area-inset-top) 높이만큼 오버레이
 */
export function StatusBarBlur() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (("standalone" in window.navigator) &&
        (window.navigator as { standalone?: boolean }).standalone === true);

    setVisible(isStandalone());

    const mq = window.matchMedia("(display-mode: standalone)");
    const handler = () => setVisible(isStandalone());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!visible) return null;

  return <div aria-hidden="true" className="status-bar-blur" />;
}
