import type { Page } from "@playwright/test";

/**
 * 시나리오와 무관한 브라우저 오류를 모은다. 스펙 끝에서 `toEqual([])`로 단언한다.
 *
 * 네트워크 상태 코드 판정은 response 핸들러(5xx)에만 맡긴다. 브라우저는 4xx 응답에도
 * "Failed to load resource ..."를 콘솔 error로 찍는데, 비로그인 상태의 401이나 텔레메트리
 * 429처럼 앱이 정상 동작하는 흐름까지 실패로 계산되기 때문이다. 실제로 nightly에서
 * 이 노이즈만으로 36개 스펙이 4일 연속 실패했다(도메인 단언은 모두 통과한 상태였다).
 */
export function observeBrowser(page: Page) {
  const failures: string[] = [];

  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isResourceStatusNoise(text)) return;
    failures.push(`console: ${text}`);
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      failures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return failures;
}

/** 브라우저가 4xx/네트워크 실패에 자동으로 찍는 콘솔 메시지인지. */
function isResourceStatusNoise(text: string) {
  return /Failed to load resource/i.test(text);
}
