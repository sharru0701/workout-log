# PR7 UI Restraint Report

## 1) 제거된 요소 목록

### A. 과도한 그림자 제거
- 전역 그림자 토큰 무력화
  - `--shadow-soft`, `--shadow-float`, `--elevation-1`, `--elevation-2` -> `none`
- 카드/표면 shadow 제거
  - `.ui-card`, `.motion-card`, `.workout-set-card`, `.rounded-*.bg-white`의 `box-shadow` 제거
- Bottom sheet shadow 제거
  - `.mobile-bottom-sheet-panel` shadow 제거

### B. 불필요한 배경 카드 제거
- 장식성 카드 배경/보더 제거
  - `.home-hero`, `.home-primary`, `.home-tools`, `.settings-menu-card`, `.settings-export-card`, `.workout-action-panel`, `.workout-empty-state`
- body 배경 단순화
  - gradient 기반 배경 체감 제거, `--color-fill-base` 단일 톤 중심

### C. 강조색 과다 사용 완화
- Primary 버튼 배경을 강한 tint fill에서 중립 surface 기반으로 변경
  - `.ui-primary-button`, `.workout-action-pill.is-primary`
- 하단 탭 활성색 강조 완화
  - `.app-bottom-nav-tab.is-active`를 중립톤 중심으로 조정

### D. 복잡한 애니메이션 제거/단축
- 진입 애니메이션 해제
  - `.native-page-enter`, `.ui-card`, `.motion-card`, `.ui-list-item`, `.workout-set-card`, `.app-sync-tray`, `.app-pwa-banner`
- 전역 모션 duration 축소
  - `fast/normal/slow`를 110/130/180ms로 단축
- transform 기반 hover motion 제거
  - `.ui-primary-button:hover`, `.workout-action-pill:hover`, `.haptic-tap:hover`

## 2) UI 단순화 전/후 비교

### Before
- 카드형 표면 위에 추가 카드가 중첩되고, shadow 깊이가 누적됨.
- 강조색이 버튼/활성 탭/상태 영역에 넓게 사용되어 시선 분산.
- page/card/list 진입 애니메이션과 hover motion이 동시 적용.

### After
- 표면 깊이는 separator 중심으로 축소, shadow 기반 계층감 제거.
- 색상 강조는 핵심 상태 전달 중심으로만 제한.
- 움직임은 최소한의 상태 전환만 유지하고 장식적 motion 제거.
- 전체 화면이 iOS Settings 스타일의 정적이고 절제된 밀도에 가까워짐.

## 3) 일관성 평가 보고서

### 평가 기준
1. Surface 일관성
2. 강조색 사용 절제
3. Motion 절제
4. 정보 위계 유지

### 결과
- Surface 일관성: **개선됨**
  - 카드 표면들이 동일한 평면 톤으로 수렴.
- 강조색 절제: **개선됨**
  - 액션 컬러가 중립톤 중심으로 정리됨.
- Motion 절제: **개선됨**
  - 진입/hover 모션 과다 사용 제거.
- 정보 위계: **유지/소폭 개선**
  - 색/그림자 대신 구조(Section/Row)로 위계를 전달.

### 잔여 리스크
- 레거시 `manage/log/dashboard` 화면은 구조적으로 복잡하므로,
  시각 절제 이후 정보량 자체는 여전히 높을 수 있음.
- 후속 PR에서 세부 화면 분해(IA 단계)와 함께 추가 정리가 필요.
