import type { SettingsDeepLinkErrorCode } from "@/lib/settings/settings-deeplink";
import { useLocale } from "@/components/locale-provider";
import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "./settings-list";

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
        <SectionHeader title={locale === "ko" ? "안내" : "Notice"} />
        <BaseGroupedList ariaLabel={locale === "ko" ? "딥링크 오류 안내" : "Deep link error details"}>
          <InfoRow
            label={locale === "ko" ? "유효하지 않은 딥링크" : "Invalid Deep Link"}
            description={errorMessage(errorCode, locale)}
            value={locale === "ko" ? "확인 필요" : "Needs review"}
            tone="warning"
            leading={<RowIcon symbol="!" tone="warning" />}
          />
          <ValueRow
            label={locale === "ko" ? "요청 key" : "Requested key"}
            value={requestedKey || (locale === "ko" ? "없음" : "None")}
            wrapValue
            leading={<RowIcon symbol="KY" tone="neutral" />}
          />
          <ValueRow
            label={locale === "ko" ? "요청 row" : "Requested row"}
            value={requestedRow || (locale === "ko" ? "없음" : "None")}
            wrapValue
            leading={<RowIcon symbol="RW" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>{locale === "ko" ? "링크 오타이거나 이전 버전 링크일 수 있습니다." : "The link may have a typo or may come from an older version."}</SectionFootnote>
      </section>

      <section>
        <SectionHeader title={locale === "ko" ? "다음 동작" : "Next Steps"} />
        <BaseGroupedList ariaLabel={locale === "ko" ? "딥링크 복구 이동" : "Deep link recovery options"}>
          <NavigationRow
            href="/"
            label={locale === "ko" ? "루트 검색 열기" : "Open Root Search"}
            description={locale === "ko" ? "설정 검색에서 다시 찾아 이동하세요." : "Find the setting again from search."}
            leading={<RowIcon symbol="SR" tone="info" />}
          />
          <NavigationRow
            href="/settings"
            label={locale === "ko" ? "설정 화면 열기" : "Open Settings"}
            description={locale === "ko" ? "설정 목록에서 직접 진입하세요." : "Open the settings list directly."}
            leading={<RowIcon symbol="SE" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>{locale === "ko" ? "형식: /settings/link/{key}?row={rowKey}" : "Format: /settings/link/{key}?row={rowKey}"}</SectionFootnote>
      </section>
    </div>
  );
}
