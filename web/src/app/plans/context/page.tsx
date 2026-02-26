import {
  BaseGroupedList,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string, fallback: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  return raw ?? fallback;
}

function readPositiveInt(params: SearchParams, key: string, fallback: number) {
  const parsed = Number(readString(params, key, String(fallback)));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toSelectionHref(pathname: string, returnTo: string) {
  const sp = new URLSearchParams();
  sp.set("returnTo", returnTo);
  return `${pathname}?${sp.toString()}`;
}

export default async function PlanContextPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const userId = readString(params, "userId", "dev");
  const startDate = readString(params, "startDate", new Date().toISOString().slice(0, 10));
  const timezone = readString(params, "timezone", "UTC");
  const sessionKeyMode = readString(params, "sessionKeyMode", "DATE");
  const week = readPositiveInt(params, "week", 1);
  const day = readPositiveInt(params, "day", 1);

  const returnQuery = new URLSearchParams();
  returnQuery.set("userId", userId);
  returnQuery.set("startDate", startDate);
  returnQuery.set("timezone", timezone);
  returnQuery.set("sessionKeyMode", sessionKeyMode);
  returnQuery.set("week", String(week));
  returnQuery.set("day", String(day));
  const returnTo = `/plans/context?${returnQuery.toString()}`;

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <ScreenTitleCard title="생성 컨텍스트" note="수정할 값을 선택하세요." />

      <section className="grid gap-2">
        <SectionHeader title="컨텍스트 항목" />
        <BaseGroupedList ariaLabel="Generation context settings">
          <ValueRow
            href={toSelectionHref("/plans/context/select/user-id", returnTo)}
            label="사용자 ID"
            description="생성 대상 사용자 범위를 선택합니다."
            value={userId}
            leading={<RowIcon symbol="US" tone="neutral" />}
          />
          <ValueRow
            href={toSelectionHref("/plans/context/picker/start-date", returnTo)}
            label="시작 날짜"
            description="생성 기준 날짜를 설정합니다."
            value={startDate}
            leading={<RowIcon symbol="DT" tone="blue" />}
          />
          <ValueRow
            href={toSelectionHref("/plans/context/select/timezone", returnTo)}
            label="시간대"
            description="날짜 경계 계산 시간대를 설정합니다."
            value={timezone}
            leading={<RowIcon symbol="TZ" tone="blue" />}
          />
          <ValueRow
            href={toSelectionHref("/plans/context/select/session-key-mode", returnTo)}
            label="세션 키 방식"
            description="세션 키 포맷을 선택합니다."
            value={sessionKeyMode}
            leading={<RowIcon symbol="SK" tone="tint" />}
          />
          <ValueRow
            href={toSelectionHref("/plans/context/picker/week", returnTo)}
            label="주차"
            description="주차 인덱스를 설정합니다."
            value={String(week)}
            leading={<RowIcon symbol="WK" tone="green" />}
          />
          <ValueRow
            href={toSelectionHref("/plans/context/picker/day", returnTo)}
            label="일차"
            description="일차 인덱스를 설정합니다."
            value={String(day)}
            leading={<RowIcon symbol="DY" tone="green" />}
          />
        </BaseGroupedList>
        <SectionFootnote>하위 화면에서 돌아오면 변경값이 즉시 반영됩니다.</SectionFootnote>
      </section>
    </div>
  );
}
