import Link from "next/link";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { APP_ROUTES } from "@/lib/app-routes";
import { NavRow } from "@/components/workout/nav-row";
import { Button } from "@/components/ui/button";
import { AppPage, PageHeader, PageSection } from "@/components/ui/page-layout";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  description: string;
  iconSymbol: string;
};

export default async function WorkoutTodayIndexPage() {
  const locale = await resolveRequestLocale();
  
  const primaryItems: NavItem[] = [
    {
      href: APP_ROUTES.todayLog,
      label: locale === "ko" ? "오늘 기록 열기" : "Open Today's Log",
      subtitle: "Today's Log",
      description: locale === "ko"
        ? "선택한 플랜으로 세션을 만들고 세트 입력과 저장을 이어갑니다."
        : "Open today's session from the selected plan and continue through set entry and saving.",
      iconSymbol: "fitness_center",
    },
    {
      href: APP_ROUTES.programStore,
      label: locale === "ko" ? "프로그램/플랜 준비" : "Prepare Programs and Plans",
      subtitle: "Programs",
      description: locale === "ko"
        ? "보유 플랜이 없으면 먼저 프로그램을 고르거나 직접 만들고 오늘 운동으로 들어갑니다."
        : "If you do not have an active plan yet, choose or create a program before starting today's workout.",
      iconSymbol: "library_books",
    },
  ];

  const toolItems: NavItem[] = [
    {
      href: APP_ROUTES.calendarHome,
      label: locale === "ko" ? "날짜로 열기" : "Open by Date",
      subtitle: "Calendar",
      description: locale === "ko"
        ? "오늘이 아닌 특정 날짜 기준으로 세션을 열거나 생성합니다."
        : "Open or generate a workout session for a specific date, not just today.",
      iconSymbol: "calendar_today",
    },
    {
      href: APP_ROUTES.todayOverrides,
      label: locale === "ko" ? "세션 조정" : "Adjust Session",
      subtitle: "Overrides",
      description: locale === "ko"
        ? "교체 운동과 보조 운동 규칙을 세밀하게 조정합니다."
        : "Fine-tune swap rules and accessory behavior for the current session.",
      iconSymbol: "tune",
    },
    {
      href: APP_ROUTES.workoutRecord,
      label: locale === "ko" ? "기록 워크스페이스" : "Record Workspace",
      subtitle: "Record",
      description: locale === "ko"
        ? "플랜 기반 기록을 다시 보거나 세부 편집이 필요할 때 사용합니다."
        : "Use the plan-based record workspace when you need to revisit or edit workout details.",
      iconSymbol: "edit_note",
    },
  ];

  return (
    <AppPage>
      <PageHeader
        eyebrow="Workout"
        title={locale === "ko" ? "오늘 운동" : "Today's Workout"}
        description={locale === "ko" ? "오늘 세션을 열고, 준비 흐름과 보조 도구를 같은 구조로 접근합니다." : "Open today's session and reach setup tools from the same consistent page hierarchy."}
        actions={(
          <Button as={Link} href={APP_ROUTES.todayLog}>
            {locale === "ko" ? "기록 시작" : "Start Logging"}
          </Button>
        )}
      />

      <PageSection title={locale === "ko" ? "핵심 동선" : "Core Flow"}>
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          {primaryItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </PageSection>

      <PageSection title={locale === "ko" ? "보조 도구" : "Tools"}>
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          {toolItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </PageSection>
    </AppPage>
  );
}
