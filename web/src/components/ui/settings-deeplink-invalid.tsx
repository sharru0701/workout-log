"use client";

import type { SettingsDeepLinkErrorCode } from "@/lib/settings/settings-deeplink";
import { useLocale } from "@/components/locale-provider";
import { V2NavRow } from "@/components/v2/primitives";
import {
  V2RowIcon,
  V2SettingsFootnote,
  V2SettingsGroup,
  V2SettingsSection,
} from "@/components/v2/settings/section";

function errorMessage(code: SettingsDeepLinkErrorCode, locale: "ko" | "en") {
  switch (code) {
    case "missing_key":
      return locale === "ko" ? "설정 키가 없는 링크입니다." : "This link does not include a settings key.";
    case "invalid_row":
      return locale === "ko" ? "row 파라미터 형식이 올바르지 않습니다." : "The row parameter format is invalid.";
    case "unknown_key":
    default:
      return locale === "ko" ? "등록되지 않은 설정 키입니다." : "This settings key is not registered.";
  }
}

export function SettingsDeepLinkInvalidView({
  errorCode,
  requestedKey,
  requestedRow,
}: {
  errorCode: SettingsDeepLinkErrorCode;
  requestedKey?: string | null;
  requestedRow?: string | null;
}) {
  const { locale } = useLocale();
  return (
    <div>
      <section>
        <V2SettingsSection title={locale === "ko" ? "안내" : "Notice"} />
        <V2SettingsGroup ariaLabel={locale === "ko" ? "딥링크 오류 안내" : "Deep link error details"}>
          <V2NavRow
            as="div"
            trailing="none"
            label={locale === "ko" ? "유효하지 않은 딥링크" : "Invalid Deep Link"}
            description={errorMessage(errorCode, locale)}
            value={locale === "ko" ? "확인 필요" : "Needs review"}
            leading={<V2RowIcon symbol="!" tone="warning" />}
          />
          <V2NavRow
            as="div"
            trailing="none"
            label={locale === "ko" ? "요청 key" : "Requested key"}
            value={requestedKey || (locale === "ko" ? "없음" : "None")}
            leading={<V2RowIcon symbol="KY" tone="neutral" />}
          />
          <V2NavRow
            as="div"
            trailing="none"
            label={locale === "ko" ? "요청 row" : "Requested row"}
            value={requestedRow || (locale === "ko" ? "없음" : "None")}
            leading={<V2RowIcon symbol="RW" tone="neutral" />}
          />
        </V2SettingsGroup>
        <V2SettingsFootnote>{locale === "ko" ? "링크 오타이거나 이전 버전 링크일 수 있습니다." : "The link may have a typo or may come from an older version."}</V2SettingsFootnote>
      </section>

      <section>
        <V2SettingsSection title={locale === "ko" ? "다음 동작" : "Next Steps"} />
        <V2SettingsGroup ariaLabel={locale === "ko" ? "딥링크 복구 이동" : "Deep link recovery options"}>
          <V2NavRow
            as="a"
            href="/"
            label={locale === "ko" ? "루트 검색 열기" : "Open Root Search"}
            description={locale === "ko" ? "설정 검색에서 다시 찾아 이동하세요." : "Find the setting again from search."}
            leading={<V2RowIcon symbol="SR" tone="info" />}
          />
          <V2NavRow
            as="a"
            href="/settings"
            label={locale === "ko" ? "설정 화면 열기" : "Open Settings"}
            description={locale === "ko" ? "설정 목록에서 직접 진입하세요." : "Open the settings list directly."}
            leading={<V2RowIcon symbol="SE" tone="neutral" />}
          />
        </V2SettingsGroup>
        <V2SettingsFootnote>{locale === "ko" ? "형식: /settings/link/{key}?row={rowKey}" : "Format: /settings/link/{key}?row={rowKey}"}</V2SettingsFootnote>
      </section>
    </div>
  );
}
