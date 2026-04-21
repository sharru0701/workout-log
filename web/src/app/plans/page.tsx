import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";
import { getAppCopy, resolveRequestLocale } from "@/lib/i18n/messages";
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

export default async function PlansIndexPage() {
  const locale = await resolveRequestLocale();
  const copy = getAppCopy(locale);
  const managementItems: NavItem[] = [
    {
      href: APP_ROUTES.plansManage,
      label: copy.plans.managementItems.active.label,
      subtitle: copy.plans.managementItems.active.subtitle,
      description: copy.plans.managementItems.active.description,
      iconSymbol: "assignment",
    },
    {
      href: APP_ROUTES.plansHistory,
      label: copy.plans.managementItems.history.label,
      subtitle: copy.plans.managementItems.history.subtitle,
      description: copy.plans.managementItems.history.description,
      iconSymbol: "history",
    },
  ];
  const setupItems: NavItem[] = [
    {
      href: APP_ROUTES.programStore,
      label: copy.plans.setupItems.store.label,
      subtitle: copy.plans.setupItems.store.subtitle,
      description: copy.plans.setupItems.store.description,
      iconSymbol: "library_books",
    },
    {
      href: APP_ROUTES.programCreate,
      label: copy.plans.setupItems.custom.label,
      subtitle: copy.plans.setupItems.custom.subtitle,
      description: copy.plans.setupItems.custom.description,
      iconSymbol: "add_circle",
    },
    {
      href: APP_ROUTES.plansContext,
      label: copy.plans.setupItems.advanced.label,
      subtitle: copy.plans.setupItems.advanced.subtitle,
      description: copy.plans.setupItems.advanced.description,
      iconSymbol: "tune",
    },
  ];

  return (
    <AppPage>
      <PageHeader
        eyebrow={copy.plans.headerEyebrow}
        title={copy.plans.title}
        description={locale === "ko" ? "활성 플랜 운영과 새 프로그램 준비를 한 화면에서 정리합니다." : "Manage active plans and prepare new programs from one shared control surface."}
        actions={(
          <Button as={Link} href={APP_ROUTES.plansManage} variant="secondary">
            {copy.plans.manage}
          </Button>
        )}
      />

      <PageSection title={copy.plans.managementSection}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {managementItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </PageSection>

      <PageSection title={copy.plans.setupSection}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {setupItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </PageSection>
    </AppPage>
  );
}
