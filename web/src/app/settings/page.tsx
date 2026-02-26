import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  SubtitleRow,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";

export default function SettingsPage() {
  return (
    <div className="native-page native-page-enter tab-screen settings-screen settings-screen-main momentum-scroll">
      <ScreenTitleCard title="설정" note="설정 도구를 선택하세요." />

      <section className="grid gap-2">
        <SectionHeader title="데이터" />
        <BaseGroupedList ariaLabel="Settings data">
          <NavigationRow
            rowId="row-data-export"
            href="/settings/data"
            label="데이터 내보내기"
            description="운동 데이터를 파일로 내려받습니다."
            leading={<RowIcon symbol="EX" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>큰 수정이나 마이그레이션 전에 먼저 내보내세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="유틸리티" />
        <BaseGroupedList ariaLabel="Settings utilities">
          <NavigationRow
            rowId="row-offline-help"
            href="/offline"
            label="오프라인 도움말"
            description="오프라인 저장 동작을 확인합니다."
            leading={<RowIcon symbol="OF" tone="orange" />}
          />
          <NavigationRow
            rowId="row-template-management"
            href="/templates"
            label="템플릿 관리"
            description="템플릿 워크스페이스를 엽니다."
            leading={<RowIcon symbol="TP" tone="neutral" />}
          />
          <NavigationRow
            rowId="row-selection-template"
            href="/settings/selection-template"
            label="선택 템플릿"
            description="선택 화면 템플릿을 확인합니다."
            leading={<RowIcon symbol="SL" tone="tint" />}
          />
          <SubtitleRow
            rowId="row-save-policy"
            href="/settings/save-policy"
            label="저장 정책"
            subtitle="즉시 반영 + 롤백"
            description="저장, 롤백, 행 잠금을 점검합니다."
            leading={<RowIcon symbol="SV" tone="green" />}
            badge="NEW"
            badgeTone="accent"
          />
          <SubtitleRow
            rowId="row-ux-thresholds"
            href="/settings/ux-thresholds"
            label="UX 기준치"
            subtitle="전환율 임계치"
            description="대시보드 UX 임계치 목표를 조정합니다."
            leading={<RowIcon symbol="UX" tone="tint" />}
            badge="NEW"
            badgeTone="accent"
          />
        </BaseGroupedList>
        <SectionFootnote>선택 템플릿과 저장 정책에서 입력/저장 규칙을 확인하세요.</SectionFootnote>
      </section>
    </div>
  );
}
