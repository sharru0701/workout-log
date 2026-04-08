import { BaseGroupedList, InfoRow, SectionFootnote, SectionHeader, ValueRow } from "@/shared/ui/settings-list";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, coerceAppLocale, parseAcceptLanguage } from "@/lib/i18n/messages";

async function resolveLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) {
    return coerceAppLocale(cookieLocale);
  }
  const requestHeaders = await headers();
  return parseAcceptLanguage(requestHeaders.get("accept-language"));
}

export default async function SettingsAboutPage() {
  const locale = await resolveLocale();
  return (
    <div>
      <section>
        <SectionHeader title={locale === "ko" ? "앱 정보" : "About"} description={locale === "ko" ? "표준 About 정보 계층" : "Standard about information"} />
        <BaseGroupedList ariaLabel={locale === "ko" ? "앱 정보" : "App information"}>
          <ValueRow
            label={locale === "ko" ? "앱 이름" : "App Name"}
            description="Product"
            value="Workout Log"
            showChevron={false}
          />
          <ValueRow
            label={locale === "ko" ? "버전" : "Version"}
            description="Version"
            value={process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
            showChevron={false}
          />
          <ValueRow
            label={locale === "ko" ? "플랫폼" : "Platform"}
            description="Runtime"
            value="Next.js"
            showChevron={false}
          />
          <InfoRow
            label={locale === "ko" ? "지원 정보" : "Support"}
            description={locale === "ko" ? "문의/버그 리포트는 프로젝트 저장소 이슈 채널을 사용하세요." : "Use the project repository issue tracker for questions and bug reports."}
          />
        </BaseGroupedList>
        <SectionFootnote>{locale === "ko" ? "About 화면은 오프라인에서도 기본 정보를 확인할 수 있습니다." : "Basic app information remains available offline on this screen."}</SectionFootnote>
      </section>
    </div>
  );
}
