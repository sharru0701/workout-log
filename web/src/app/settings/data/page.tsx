import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

export default function DataExportPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <header className="grid gap-1 px-1">
        <h1 className="type-title m-0">데이터 내보내기</h1>
        <p className="type-caption m-0">파일 형식을 선택하세요.</p>
      </header>

      <section className="grid gap-2">
        <SectionHeader title="내보내기 파일" />
        <BaseGroupedList ariaLabel="Export options">
          <NavigationRow
            rowId="row-download-json"
            href="/api/export?format=json"
            label="JSON 다운로드"
            subtitle="구조형"
            description="템플릿, 플랜, 세션, 로그를 함께 내보냅니다."
            leading={<RowIcon symbol="JS" tone="blue" />}
          />
          <NavigationRow
            rowId="row-download-csv"
            href="/api/export?format=csv&type=workout_set"
            label="CSV 다운로드"
            subtitle="테이블형"
            description="workout_set 행 기반으로 내보냅니다."
            leading={<RowIcon symbol="CV" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>전체 백업은 JSON, 분석용 추출은 CSV를 권장합니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="안내" />
        <BaseGroupedList ariaLabel="Export notes">
          <ValueRow
            rowId="row-output-mode"
            label="출력 방식"
            description="선택 즉시 다운로드가 시작됩니다."
            value="직접"
            leading={<RowIcon symbol="DL" tone="green" />}
          />
          <InfoRow
            rowId="row-back-navigation"
            label="돌아가기"
            description="다운로드 시작 후 이전 화면으로 돌아갈 수 있습니다."
            value="Push"
            leading={<RowIcon symbol="IA" tone="neutral" />}
            tone="neutral"
          />
        </BaseGroupedList>
        <SectionFootnote>다운로드가 시작되지 않으면 같은 Row에서 다시 시도하세요.</SectionFootnote>
      </section>
    </div>
  );
}
