"use client";

import { useState } from "react";
import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  SubtitleRow,
  ToggleRow,
  ValueRow,
} from "./settings-list";
import { settingsListTokenDefaults } from "./settings-list.tokens";
import { DisabledStateRows, EmptyStateRows, ErrorStateRows, LoadingStateRows } from "./settings-state";

export function SettingsListExample() {
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const [cellularEnabled, setCellularEnabled] = useState(true);
  const [showLoading, setShowLoading] = useState(false);

  return (
    <div className="native-page tab-screen momentum-scroll">
      <SectionHeader title="연결" />
      <BaseGroupedList ariaLabel="Connectivity settings">
        <ToggleRow
          label="Wi-Fi"
          subtitle="기본 네트워크"
          description={wifiEnabled ? "Home-5G에 연결됨" : "꺼짐"}
          checked={wifiEnabled}
          onCheckedChange={setWifiEnabled}
          leading={<RowIcon symbol="WF" tone="blue" />}
        />
        <ToggleRow
          label="셀룰러 데이터"
          checked={cellularEnabled}
          onCheckedChange={setCellularEnabled}
          leading={<RowIcon symbol="CL" tone="green" />}
        />
        <ValueRow label="VPN" value="연결 안 됨" leading={<RowIcon symbol="VP" tone="neutral" />} />
        <SubtitleRow
          label="개인용 핫스팟"
          subtitle="테더링"
          value="꺼짐"
          href="/system/app"
          leading={<RowIcon symbol="HS" tone="orange" />}
          badge="NEW"
          badgeTone="accent"
        />
      </BaseGroupedList>
      <SectionFootnote>예시는 공통 행 조합만 보여줍니다.</SectionFootnote>

      <SectionHeader title="상태" />
      <BaseGroupedList
        ariaLabel="Status settings"
        tokens={{
          ...settingsListTokenDefaults,
          "--settings-group-background": "color-mix(in srgb, var(--bg-surface) 90%, transparent)",
        }}
      >
        <InfoRow
          label="동기화"
          description="2분 전에 동기화됨"
          value="정상"
          tone="success"
          leading={<RowIcon symbol="SY" tone="green" />}
        />
        <InfoRow
          label="오프라인 대기열"
          description="운동 로그 2건 대기"
          value="확인 필요"
          tone="warning"
          leading={<RowIcon symbol="Q" tone="orange" />}
          badge="!"
          badgeTone="warning"
        />
        <NavigationRow
          label={showLoading ? "로딩 예시 숨기기" : "로딩 예시 보기"}
          description="지연 뒤 로딩 행이 표시됩니다."
          onPress={() => setShowLoading((prev) => !prev)}
          leading={<RowIcon symbol="LD" tone="blue" />}
        />
      </BaseGroupedList>
      <SectionFootnote>모든 행은 같은 높이와 좌우 패딩을 사용합니다.</SectionFootnote>

      <SectionHeader title="상태 행" />
      <LoadingStateRows active={showLoading} />
      <EmptyStateRows when label="설정 값 없음" description="샘플 환경에서 표시할 값이 없습니다." />
      <ErrorStateRows message="샘플 오류 메시지입니다." onRetry={() => setShowLoading(false)} />
      <DisabledStateRows when label="현재 사용할 수 없음" description="선행 설정 완료 후 다시 시도하세요." />
      <SectionFootnote>로딩, 빈 상태, 오류, 비활성 패턴을 공통 규칙으로 제공합니다.</SectionFootnote>
    </div>
  );
}
