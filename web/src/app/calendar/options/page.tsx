import {
  DashboardActionSection,
  DashboardHero,
  DashboardScreen,
} from "@/components/dashboard/dashboard-primitives";
import { APP_ROUTES } from "@/lib/app-routes";

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
  const returnTo = `${APP_ROUTES.calendarOptions}?${returnQuery.toString()}`;

  const optionCards = [
    {
      href: toSelectionHref("/calendar/options/select/view-mode", returnTo),
      title: "보기 방식",
      description: "기본 그리드 보기를 설정합니다.",
      meta: viewMode,
      symbol: "VM",
      tone: "accent" as const,
    },
    {
      href: toSelectionHref("/calendar/options/select/timezone", returnTo),
      title: "시간대",
      description: "날짜 경계 계산 시간대를 설정합니다.",
      meta: timezone,
      symbol: "TZ",
      tone: "default" as const,
    },
    {
      href: toSelectionHref("/calendar/options/select/auto-open", returnTo),
      title: "열기 동작",
      description: "날짜 열기 시 동작을 선택합니다.",
      meta: autoOpenMode === "AUTO_GENERATE" ? "자동 생성" : "열기만",
      symbol: "AO",
      tone: "success" as const,
    },
    {
      href: toSelectionHref("/calendar/options/picker/open-time", returnTo),
      title: "기본 열기 시간",
      description: "날짜 열기 기본 시간을 설정합니다.",
      meta: openTime,
      symbol: "TM",
      tone: "warning" as const,
    },
  ];

  return (
    <DashboardScreen>
      <DashboardHero
        eyebrow="캘린더 설정"
        title="날짜를 눌렀을 때 어떻게 열지 정하기"
        description="캘린더에서 날짜를 눌렀을 때 열기만 할지, 세션 생성까지 이어질지 정하는 화면입니다."
        primaryAction={{ href: APP_ROUTES.calendarManage, label: "캘린더 열기", tone: "primary" }}
        secondaryAction={{ href: APP_ROUTES.calendarHome, label: "캘린더 홈", tone: "secondary" }}
        metrics={[
          { label: "보기", value: viewMode },
          { label: "열기", value: autoOpenMode === "AUTO_GENERATE" ? "자동 생성" : "열기만" },
          { label: "시간", value: openTime },
        ]}
      />

      <DashboardActionSection
        title="옵션 항목"
        description="현재 값을 확인하면서 바로 수정 화면으로 이동할 수 있습니다."
        items={optionCards}
      />
    </DashboardScreen>
  );
}
