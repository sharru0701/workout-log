-- ============================================================================
-- 1회성 데이터 보정: 5월 Pull-Up 로그 맨몸 총부하 메타 백필
-- ----------------------------------------------------------------------------
-- 배경:
--   맨몸 운동(풀업)은 기록 시 weight_kg=외부 추가중량, meta.totalLoadKg=체중+추가로
--   저장해 화면에서 총무게로 표기한다(PR #370~#373). 그런데 2026년 5월에는 체중
--   설정(prefs.bodyweight.kg)이 비어 있어 로그에 메타가 붙지 않았고, 그 결과:
--     - 대부분의 5월 풀업 로그: weight_kg=외부중량(5/10/15/20/25/0), 메타 없음
--     - 2026-05-23(C2W6D1): 처방 총부하 97.5가 외부중량 칸에 그대로 저장된 이상치
--   같은 운동이 화면에서 97.5 vs 25 로 보이는 표기 불일치가 발생했다.
--   (근본 원인인 시드 로직은 prescriptionToExternalLoadKg 가드로 코드 수정함.)
--
-- 적용 대상:
--   workout_log.performed_at ∈ [2026-05-01, 2026-06-01) 의 Pull-Up/Chin-Up 세트 중
--   meta.totalLoadKg 가 없는 행 (5월 51개 세트).
--
-- 가정/규칙:
--   - 가정 체중 = 74kg (사용자 확인. 현재 설정값과 동일, 3~4월 73과 근접).
--   - weight_kg >= 74 인 행(=총부하가 외부중량 칸에 들어간 이상치, 05-23)은
--     외부중량 25 / 총부하 99 로 교정해 같은 주(W6) D2/D3 와 일치시킨다.
--   - 그 외 행은 weight_kg(외부중량) 유지, totalLoadKg = weight_kg + 74 부여.
--   - 감사용으로 meta.backfilled=true 플래그를 남긴다.
--
-- 실행 환경/일자:
--   workout-log-prod (Supabase project edaoieuohxtqiyzcwnjj), 2026-06-01 실행 완료.
--   ※ 자동 실행 금지. Drizzle 마이그레이션 아님. 재실행 시 멱등(meta.totalLoadKg
--     있는 행은 제외되므로 안전)하나, 가정 체중/이상치 규칙이 다른 환경엔 맞지 않음.
-- ============================================================================

-- 1) 미리보기: 영향 행 + 변경 예정값 (적용 전 반드시 확인)
with target as (
  select s.id, l.performed_at::date d, s.exercise_name,
         s.set_number, s.reps, s.weight_kg::numeric as cur_w
  from workout_set s
  join workout_log l on l.id = s.log_id
  where (lower(s.exercise_name) like '%pull%' or lower(s.exercise_name) like '%chin%')
    and l.performed_at >= '2026-05-01' and l.performed_at < '2026-06-01'
    and not (s.meta ? 'totalLoadKg')
)
select d, exercise_name, set_number, reps, cur_w,
       case when cur_w >= 74 then 25 else cur_w end       as new_external,
       case when cur_w >= 74 then 99 else cur_w + 74 end  as new_total,
       cur_w >= 74                                        as was_total_outlier
from target
order by d, set_number;

-- 2) 적용
with target as (
  select s.id, s.weight_kg::numeric as cur_w
  from workout_set s
  join workout_log l on l.id = s.log_id
  where (lower(s.exercise_name) like '%pull%' or lower(s.exercise_name) like '%chin%')
    and l.performed_at >= '2026-05-01' and l.performed_at < '2026-06-01'
    and not (s.meta ? 'totalLoadKg')
)
update workout_set s
set weight_kg = case when t.cur_w >= 74 then 25 else t.cur_w end,
    meta = coalesce(s.meta, '{}'::jsonb)
           || jsonb_build_object(
                'bodyweightKg', 74,
                'totalLoadKg', case when t.cur_w >= 74 then 99 else t.cur_w + 74 end,
                'backfilled', true
              )
from target t
where s.id = t.id;

-- 3) 검증: 남은 메타 누락 행은 0 이어야 한다
select count(*) as remaining_no_meta
from workout_set s
join workout_log l on l.id = s.log_id
where (lower(s.exercise_name) like '%pull%' or lower(s.exercise_name) like '%chin%')
  and l.performed_at >= '2026-05-01' and l.performed_at < '2026-06-01'
  and not (s.meta ? 'totalLoadKg');
