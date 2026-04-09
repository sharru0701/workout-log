import { Suspense } from "react";
import { getCalendarPageBootstrap } from "@/server/services/calendar/get-calendar-page-bootstrap";
import { CalendarScreen } from "@/widgets/calendar-screen";
import CalendarLoading from "./loading";

// PERF: PPR - 레이아웃 쉘 즉시 서빙, 캘린더 데이터는 스트리밍
export const experimental_ppr = true;

async function CalendarPageContent() {
  const bootstrap = await getCalendarPageBootstrap();
  return <CalendarScreen {...bootstrap} />;
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarPageContent />
    </Suspense>
  );
}
