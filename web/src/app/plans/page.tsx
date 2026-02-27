import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

export default function PlansIndexPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">

      <section className="grid gap-2">
        <SectionHeader title="플랜 관리" />
        <BaseGroupedList ariaLabel="Plan management">
          <NavigationRow
            href="/plans/manage"
            label="플랜 워크스페이스"
            subtitle="기본"
            description="플랜을 선택하고 생성 작업을 실행합니다."
            leading={<RowIcon symbol="PW" tone="green" />}
          />
          <NavigationRow
            href="/plans/create"
            label="플랜 만들기"
            subtitle="생성"
            description="단일, 조합, 수동 플랜을 생성합니다."
            leading={<RowIcon symbol="CP" tone="green" />}
          />
          <NavigationRow
            href="/plans/context"
            label="생성 컨텍스트"
            subtitle="입력"
            description="날짜, 시간대, 주차, 일차를 설정합니다."
            leading={<RowIcon symbol="GC" tone="tint" />}
          />
        </BaseGroupedList>
        <SectionFootnote>필요한 경우 생성 전에 컨텍스트를 먼저 맞추세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="프로그램 소스" />
        <BaseGroupedList ariaLabel="Plan sources">
          <NavigationRow
            href="/templates"
            label="템플릿"
            description="템플릿 라이브러리를 엽니다."
            leading={<RowIcon symbol="TP" tone="neutral" />}
          />
          <ValueRow
            label="입력 방식"
            description="입력은 하위 화면으로 이동해 처리합니다."
            value="Push-first"
            leading={<RowIcon symbol="MD" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>템플릿 수정은 템플릿 워크스페이스에서 진행합니다.</SectionFootnote>
      </section>
    </div>
  );
}
