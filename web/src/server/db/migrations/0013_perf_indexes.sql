-- PERF: compliance 쿼리의 coalesce(scheduled_at, updated_at) 범위 필터를 가속하는 함수형 복합 인덱스
-- stats/bundle route에서 userId + coalesce(scheduled_at, updated_at) BETWEEN from AND to 필터에 사용
CREATE INDEX IF NOT EXISTS "generated_session_user_scheduled_at_idx"
  ON "generated_session" ("user_id", coalesce("scheduled_at", "updated_at"));
