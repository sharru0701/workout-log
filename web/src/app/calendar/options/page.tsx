import {
  BaseGroupedList,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string, fallback: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  return raw ?? fallback;
}

function toSelectionHref(pathname: string, returnTo: string) {
  const sp = new URLSearchParams();
  sp.set("returnTo", returnTo);
  return `${pathname}?${sp.toString()}`;
}

export default async function CalendarOptionsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const viewMode = readString(params, "viewMode", "month");
  const timezone = readString(params, "timezone", "UTC");
  const autoOpenMode = readString(params, "autoOpen", "OPEN_ONLY");
  const openTime = readString(params, "openTime", "08:00");

  const returnQuery = new URLSearchParams();
  returnQuery.set("viewMode", viewMode);
  returnQuery.set("timezone", timezone);
  returnQuery.set("autoOpen", autoOpenMode);
  returnQuery.set("openTime", openTime);
  const returnTo = `/calendar/options?${returnQuery.toString()}`;

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">

      <section className="grid gap-2">
        <SectionHeader title="보기 및 열기" />
        <BaseGroupedList ariaLabel="Calendar options">
          <ValueRow
            href={toSelectionHref("/calendar/options/select/view-mode", returnTo)}
            label="보기 방식"
            description="기본 그리드 보기를 설정합니다."
            value={viewMode}
            leading={<RowIcon symbol="VM" tone="blue" />}
          />
          <ValueRow
            href={toSelectionHref("/calendar/options/select/timezone", returnTo)}
            label="시간대"
            description="날짜 경계 계산 시간대를 설정합니다."
            value={timezone}
            leading={<RowIcon symbol="TZ" tone="blue" />}
          />
          <ValueRow
            href={toSelectionHref("/calendar/options/select/auto-open", returnTo)}
            label="열기 동작"
            description="날짜 열기 시 동작을 선택합니다."
            value={autoOpenMode === "AUTO_GENERATE" ? "자동 생성" : "열기만"}
            leading={<RowIcon symbol="AO" tone="tint" />}
          />
          <ValueRow
            href={toSelectionHref("/calendar/options/picker/open-time", returnTo)}
            label="기본 열기 시간"
            description="날짜 열기 기본 시간을 설정합니다."
            value={openTime}
            leading={<RowIcon symbol="TM" tone="green" />}
          />
        </BaseGroupedList>
        <SectionFootnote>하위 화면에서 돌아오면 값이 즉시 반영됩니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="적용" />
        <BaseGroupedList ariaLabel="Calendar options apply">
          <ValueRow
            href={`/calendar/manage?${returnQuery.toString()}`}
            label="캘린더 워크스페이스 열기"
            description="현재 값으로 워크스페이스를 엽니다."
            value="열기"
            leading={<RowIcon symbol="GO" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>설정을 확인한 뒤 워크스페이스를 열어 진행하세요.</SectionFootnote>
      </section>
    </div>
  );
}
