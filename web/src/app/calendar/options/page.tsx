import Link from "next/link";
import {
  DashboardActionSection,
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
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Calendar Settings</span>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "2px 0 6px" }}>캘린더 옵션</h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.4 }}>날짜를 눌렀을 때 열기만 할지, 세션 생성까지 이어질지 정하는 화면입니다.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-xs)", marginBottom: "var(--space-md)", background: "var(--color-surface-2)", borderRadius: 12, padding: "var(--space-sm)" }}>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>보기</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)" }}>{viewMode}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>열기</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)" }}>{autoOpenMode === "AUTO_GENERATE" ? "자동 생성" : "열기만"}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>시간</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)" }}>{openTime}</div>
          </div>
        </div>
        <Link href={APP_ROUTES.calendarHome} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-action)", color: "#fff", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: "14px", textDecoration: "none", letterSpacing: "-0.1px" }}>
          캘린더로 돌아가기
        </Link>
      </div>

      <DashboardActionSection
        title="옵션 항목"
        description="현재 값을 확인하면서 바로 수정 화면으로 이동할 수 있습니다."
        items={optionCards}
      />
    </DashboardScreen>
  );
}
