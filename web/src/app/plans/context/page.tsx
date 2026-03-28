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
  const returnTo = `${APP_ROUTES.plansContext}?${returnQuery.toString()}`;

  const contextCards = [
    {
      href: toSelectionHref("/plans/context/select/user-id", returnTo),
      title: "사용자 ID",
      description: "생성 대상 사용자 범위를 선택합니다.",
      meta: userId,
      symbol: "US",
      tone: "neutral" as const,
    },
    {
      href: toSelectionHref("/plans/context/picker/start-date", returnTo),
      title: "시작 날짜",
      description: "생성 기준 날짜를 설정합니다.",
      meta: startDate,
      symbol: "DT",
      tone: "accent" as const,
    },
    {
      href: toSelectionHref("/plans/context/select/timezone", returnTo),
      title: "시간대",
      description: "날짜 경계 계산 시간대를 설정합니다.",
      meta: timezone,
      symbol: "TZ",
      tone: "default" as const,
    },
    {
      href: toSelectionHref("/plans/context/select/session-key-mode", returnTo),
      title: "세션 키 방식",
      description: "세션 키 포맷을 선택합니다.",
      meta: sessionKeyMode,
      symbol: "SK",
      tone: "success" as const,
    },
    {
      href: toSelectionHref("/plans/context/picker/week", returnTo),
      title: "주차",
      description: "주차 인덱스를 설정합니다.",
      meta: String(week),
      symbol: "WK",
      tone: "default" as const,
    },
    {
      href: toSelectionHref("/plans/context/picker/day", returnTo),
      title: "일차",
      description: "일차 인덱스를 설정합니다.",
      meta: String(day),
      symbol: "DY",
      tone: "warning" as const,
    },
  ];

  return (
    <DashboardScreen>
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Advanced</span>
        <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "2px 0 6px" }}>생성 기준 확인</h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 var(--space-md)", lineHeight: 1.4 }}>날짜, 시간대, 세션 키 기준을 점검하는 화면입니다.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-xs)", marginBottom: "var(--space-md)", background: "var(--color-surface-2)", borderRadius: 12, padding: "var(--space-sm)" }}>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>시작일</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text)" }}>{startDate}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>시간대</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text)" }}>{timezone}</div>
          </div>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>세션 키</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text)" }}>{sessionKeyMode}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <Link href={APP_ROUTES.programStore} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-action)", color: "#fff", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: "14px", textDecoration: "none", letterSpacing: "-0.1px" }}>
            프로그램 고르기
          </Link>
          <Link href={APP_ROUTES.programCreate} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-2)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: "14px", textDecoration: "none" }}>
            커스텀 만들기
          </Link>
        </div>
      </div>

      <DashboardActionSection
        title="기준 항목"
        description="현재 값과 수정 진입점을 한 카드에 묶어 두었습니다."
        items={contextCards}
      />
    </DashboardScreen>
  );
}
