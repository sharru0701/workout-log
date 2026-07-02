-- PERF: 플랜 스코프 날짜 조회를 가속하는 복합 인덱스.
-- findLogIdForDate / fetchRecentLogsServer / rebuildAutoProgressionForPlan 등이
-- userId + planId + performed_at 범위/정렬로 조회하는데, 기존엔 (user_id, performed_at)
-- 또는 (plan_id) 단독 인덱스만 있어 plan_id를 후처리 필터하며 스캔 폭이 넓었다.
CREATE INDEX IF NOT EXISTS "workout_log_user_plan_performed_idx"
  ON "workout_log" ("user_id", "plan_id", "performed_at");

-- PERF: 로그 목록의 진행 이벤트 조회가 log_id만으로 inArray 필터(plan_id 없음)라
-- 기존 (plan_id, log_id, program_slug) 유니크 인덱스(선두 plan_id)를 못 타 seq scan이었다.
CREATE INDEX IF NOT EXISTS "plan_progress_event_log_idx"
  ON "plan_progress_event" ("log_id");
