import { Suspense } from "react";
import { getCalendarPageBootstrap } from "@/server/services/calendar/get-calendar-page-bootstrap";
import { CalendarScreen } from "@/widgets/calendar-screen";
import CalendarLoading from "./loading";


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
