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

export default async function TemplatesIndexPage() {
  const locale = await resolveRequestLocale();
  const copy = getAppCopy(locale);
  const libraryItems: NavItem[] = [
    {
      href: APP_ROUTES.templatesManage,
      label: copy.templates.libraryItems.browse.label,
      subtitle: copy.templates.libraryItems.browse.subtitle,
      description: copy.templates.libraryItems.browse.description,
      iconSymbol: "style",
    },
    {
      href: APP_ROUTES.templatesManage,
      label: copy.templates.libraryItems.forkEdit.label,
      subtitle: copy.templates.libraryItems.forkEdit.subtitle,
      description: copy.templates.libraryItems.forkEdit.description,
      iconSymbol: "fork_right",
    },
  ];
  const integrationItems: NavItem[] = [
    {
      href: APP_ROUTES.programStore,
      label: copy.templates.integrationItems.store.label,
      subtitle: copy.templates.integrationItems.store.subtitle,
      description: copy.templates.integrationItems.store.description,
      iconSymbol: "library_books",
    },
    {
      href: APP_ROUTES.programCreate,
      label: copy.templates.integrationItems.custom.label,
      subtitle: copy.templates.integrationItems.custom.subtitle,
      description: copy.templates.integrationItems.custom.description,
      iconSymbol: "add_circle",
    },
  ];

  return (
    <AppPage>
      <PageHeader
        eyebrow={copy.templates.headerEyebrow}
        title={copy.templates.title}
        description={locale === "ko" ? "템플릿 운영 흐름과 프로그램 연동 지점을 같은 방식으로 탐색합니다." : "Browse template workflows and downstream program integration with the same shared navigation pattern."}
        actions={(
          <Button as={Link} href={APP_ROUTES.templatesManage} variant="secondary">
            {copy.templates.manage}
          </Button>
        )}
      />

      <PageSection title={copy.templates.workSection}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {libraryItems.map((item) => (
            <NavRow key={`${item.href}-${item.iconSymbol}`} item={item} />
          ))}
        </div>
      </PageSection>

      <PageSection title={copy.templates.flowSection}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {integrationItems.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </div>
      </PageSection>
    </AppPage>
  );
}
