import type { SettingsDeepLinkErrorCode } from "@/lib/settings/settings-deeplink";
import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "./settings-list";

function errorMessage(code: SettingsDeepLinkErrorCode) {
  switch (code) {
    case "missing_key":
      return "설정 키가 없는 링크입니다.";
    case "invalid_row":
      return "row 파라미터 형식이 올바르지 않습니다.";
    case "unknown_key":
    default:
      return "등록되지 않은 설정 키입니다.";
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
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <header className="grid gap-1 px-1">
        <h1 className="type-title m-0">설정 링크</h1>
        <p className="type-caption m-0">링크를 열 수 없습니다.</p>
      </header>

      <section className="grid gap-2">
        <SectionHeader title="안내" />
        <BaseGroupedList ariaLabel="딥링크 오류 안내">
          <InfoRow
            label="유효하지 않은 딥링크"
            description={errorMessage(errorCode)}
            value="확인 필요"
            tone="warning"
            leading={<RowIcon symbol="!" tone="orange" />}
          />
          <ValueRow
            label="요청 key"
            value={requestedKey || "없음"}
            wrapValue
            leading={<RowIcon symbol="KY" tone="neutral" />}
          />
          <ValueRow
            label="요청 row"
            value={requestedRow || "없음"}
            wrapValue
            leading={<RowIcon symbol="RW" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>링크 오타이거나 이전 버전 링크일 수 있습니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="다음 동작" />
        <BaseGroupedList ariaLabel="딥링크 복구 이동">
          <NavigationRow
            href="/"
            label="루트 검색 열기"
            description="설정 검색에서 다시 찾아 이동하세요."
            leading={<RowIcon symbol="SR" tone="blue" />}
          />
          <NavigationRow
            href="/settings"
            label="설정 화면 열기"
            description="설정 목록에서 직접 진입하세요."
            leading={<RowIcon symbol="SE" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>{"형식: /settings/link/{key}?row={rowKey}"}</SectionFootnote>
      </section>
    </div>
  );
}
