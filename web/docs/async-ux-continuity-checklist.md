# Async UX Continuity Checklist

## Scope
- 하단 탭 전환/필터 변경/리로드 시 화면 깜빡임(Empty 조기 노출, 틱틱거림, 이중 모션)을 최소화했는지 점검한다.

## Precondition
- OS `Reduce Motion` 설정은 `OFF`로 확인한다.
- 네트워크 Throttling은 `Fast 3G` 또는 DevTools `Slow 4G`로 한 번 이상 점검한다.

## Scenario 1: Bottom Tab Transition
1. 홈(`/`)에서 `프로그램 스토어` 탭을 누른다.
2. 캡슐 인디케이터가 한 번에 좌우로 이동하는지 확인한다.
3. 전환 중 이전 화면/신규 화면이 이중 흔들림 없이 1회 이동으로 끝나는지 확인한다.
4. 전환 직후 `설정 값 없음`이 먼저 잠깐 나타났다가 사라지는 플래시가 없는지 확인한다.

## Scenario 2: Plans / Templates Load
1. `/plans/manage` 진입 후 초기 로드 동안 빈 상태 문구가 먼저 뜨지 않는지 확인한다.
2. 데이터 로드 완료 후 실제 리스트가 렌더되는지 확인한다.
3. `/templates/manage`에서도 동일하게 초기 빈 상태 플래시 없이 리스트/편집기가 이어지는지 확인한다.

## Scenario 3: Stats Deferred Query Flow
1. `/stats/dashboard` 진입 후 코어 지표 로드 중 empty-state 조기 노출이 없는지 확인한다.
2. 세부 지표(퍼널/시계열/PR)가 뒤늦게 로드될 때도 섹션별 empty-state 플래시가 없는지 확인한다.
3. 필터를 변경해 재조회해도 동일하게 empty-state가 조회 완료 후에만 나타나는지 확인한다.

## Scenario 4: Workout Context
1. `/workout/today/log` 진입 직후 `플랜 미선택` 경고가 선행 노출되지 않는지 확인한다.
2. `/workout/session/[logId]` 진입 시 공백 프레임 없이 로딩→데이터 렌더로 이어지는지 확인한다.

## Pass Criteria
- 로딩 전환 중 empty-state가 먼저 튀는 장면이 관찰되지 않는다.
- 동일 동작 반복 3회에서 재현성 있게 깜빡임/이중모션이 발생하지 않는다.
