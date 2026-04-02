-- PERF: compliance 쿼리의 (userId, generatedSessionId) 복합 필터를 가속하는 인덱스
-- stats/bundle route에서 inArray(generatedSessionId) + userId 필터 조합에 사용
CREATE INDEX IF NOT EXISTS "workout_log_user_session_idx"
  ON "workout_log" ("user_id", "generated_session_id");
