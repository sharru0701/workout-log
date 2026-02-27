import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

export default function PlanCreatePage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">

      <section className="grid gap-2">
        <SectionHeader title="생성 방식" />
        <BaseGroupedList ariaLabel="Plan creation flows">
          <NavigationRow
            href="/plans/manage"
            label="단일 플랜"
            description="하나의 템플릿으로 플랜을 생성합니다."
            value="워크스페이스"
            leading={<RowIcon symbol="SP" tone="green" />}
          />
          <NavigationRow
            href="/plans/manage"
            label="조합 플랜"
            description="리프트별 템플릿을 조합해 생성합니다."
            value="워크스페이스"
            leading={<RowIcon symbol="CP" tone="green" />}
          />
          <NavigationRow
            href="/plans/manage"
            label="수동 플랜"
            description="스케줄 키를 지정해 세션을 구성합니다."
            value="워크스페이스"
            leading={<RowIcon symbol="MP" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>실제 생성 작업은 플랜 워크스페이스에서 실행됩니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="안내" />
        <BaseGroupedList ariaLabel="Plan creation notes">
          <ValueRow
            label="모달 사용"
            description="모달 중심 생성 흐름을 사용하지 않습니다."
            value="최소화"
            leading={<RowIcon symbol="MD" tone="neutral" />}
          />
          <InfoRow
            label="실행"
            description="워크스페이스 액션으로 생성 요청을 보냅니다."
            leading={<RowIcon symbol="EX" tone="blue" />}
            tone="neutral"
          />
        </BaseGroupedList>
        <SectionFootnote>새 플랜 저장 전 컨텍스트 값을 다시 확인하세요.</SectionFootnote>
      </section>
    </div>
  );
}
