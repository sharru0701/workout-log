# v2 디자인 + 인증 시스템 — 다음 PR 계획서

> 작성: 2026-05-07
> 컨텍스트: 지난 6번의 작업 세션에서 v2 디자인 + 멀티유저 인증 + 키패드 통합까지 진행. 이 문서는 다음 PR을 새 세션에서 즉시 시작할 수 있도록 잔여 작업을 정리한 것.

---

## 0. 현재 상태 요약 (2026-05-07 기준)

### 완료
- v2 디자인 토큰 + 글로벌 오버라이드 (`v2-tokens.css`, `v2-overrides.css`)
- v2 primitives (`Card`/`Chip`/`IconBtn`/`PrimaryBtn`/`SecondaryBtn`/`Sheet`/`ActionDock`)
- 홈 페이지 3-덱 스와이프 (Today/Progress/History)
- ActionDock 5-슬롯 IA (시작 / 홈 / 계획시트 / 라이브러리시트 / 더보기시트)
- 세션 요약 v2 (`/workout/session/[logId]`) + freshComplete 콘페티
- PR 감지 (progression event + 서버 best e1RM 비교 + alias/exerciseId 매칭)
- 빠른 기록 (`/workout/log/keypad`) + 본 화면 키패드 시트 오버레이 (PROGRAM + USER 운동, 무게 + reps, 휴식 타이머, 권장 무게 단축)
- 온보딩 (`/onboarding`) + 첫 진입 자동 트리거
- PlanSheet 캘린더 (월 이동, 빈 날짜 → 빠른 기록, 수행일 → 세션 상세)
- LibrarySheet (프로그램 / 운동 탭, lazy fetch)
- MoreSheet (사용자 카드, 비밀번호 변경, 로그아웃, 외관/데이터 단축)
- 인증 시스템 (DB schema, PBKDF2 해시, cookie 세션, /api/auth/{signup,login,logout,me,password}, 미들웨어)
- 보안 (rate limiting, Origin CSRF 체크, 첫 가입자 dev 데이터 claim)
- Session pruning ops endpoint (`POST /api/ops/sessions/prune`)

### 미해결 (이 문서의 범위)
아래 섹션 1~6.

---

## 1. 우선순위 매트릭스

| # | 항목 | 효과 | 노력 | 위험 | 권장 순서 |
|---|---|---|---|---|---|
| A1 | 비밀번호 재설정 (이메일) | ★★★ | 중 | 낮 | **1순위 — 잠김 방지** |
| A2 | 이메일 인증 (verify) | ★★ | 중 | 낮 | A1과 함께 |
| A3 | OAuth (Google) | ★★ | 큼 | 중 | A1 후 |
| A4 | 활성 세션 목록 + 개별 종료 | ★★ | 작 | 낮 | 단독 가능 |
| A5 | 2FA (TOTP) | ★ | 중 | 낮 | 이메일 인프라 후 |
| A6 | 계정 삭제 (GDPR) | ★★ | 작 | 낮 | A4와 묶음 |
| B1 | 본 운동기록 화면 v2 카드 | ★★★ | 큼 | 중 | **2순위 — 시각 일관성** |
| B2 | RPE 입력 슬롯 추가 | ★★ | 중 | 중 | B1 안에서 |
| B3 | 휴식 타이머 햅틱/사운드 | ★ | 작 | 낮 | B1 후 |
| C1 | 통계 페이지 v2 디자인 | ★★★ | 큼 | 낮 | **3순위 — 메인 페이지 다음** |
| C2 | 운동 상세 페이지 v2 | ★★ | 중 | 낮 | C1과 함께 |
| C3 | PR 히스토리 전용 화면 | ★★ | 작 | 낮 | C1 후 |
| D1 | 백업 / 복원 (JSON/CSV) | ★★★ | 중 | 중 | **4순위 — 데이터 안전성** |
| D2 | 온보딩 데이터 import | ★★ | 작 | 낮 | D1 의존 |
| E1 | Rate limit Redis 분산 | ★★ | 중 | 중 | 멀티 인스턴스 시 필수 |
| E2 | 인증 이벤트 로깅 | ★★ | 작 | 낮 | A시리즈와 함께 |
| F1 | E2E 테스트 (인증 흐름) | ★★ | 중 | 낮 | 피처 안정화 후 |

---

## 2. 카테고리별 상세

### A. 인증 / 보안 강화

#### A1. 비밀번호 재설정 (P0)
**문제**: 사용자가 비밀번호 분실 시 복구 불가능. 계정 영구 손실.

**구현**:
1. **이메일 발송 인프라** — Resend 또는 SES 선택
   - `RESEND_API_KEY` 환경변수
   - `web/src/server/email/sender.ts` 추가
2. **DB schema** — `password_reset_token` 테이블
   ```ts
   token (pk text), userId, createdAt, expiresAt (1시간), usedAt
   ```
3. **API**:
   - `POST /api/auth/password/reset/request` — 이메일 입력 → 항상 200 (enumeration 방지) → 이메일 존재 시 토큰 생성 + 메일 발송
   - `POST /api/auth/password/reset/confirm` — `{token, newPassword}` → 토큰 검증 + 일회성 마킹 + 새 해시 저장 + 모든 세션 무효화
4. **UI**:
   - `/login` 폼 하단에 "비밀번호 분실?" 링크 → `/forgot-password`
   - `/forgot-password` (이메일 입력) → 발송 안내
   - `/reset-password?token=...` (새 비밀번호 입력)
5. **이메일 템플릿** — 한/영, link expiry 안내, "본인이 요청하지 않았으면 무시" 카피

**리스크**:
- 이메일 인프라 비용 (Resend: 100/day 무료)
- 이메일 deliverability — SPF/DKIM/DMARC 설정 필요
- 토큰 leak 방어: 일회성 + 짧은 expiry + HTTPS only

**테스트**:
- 토큰 만료 후 거부
- 이미 사용한 토큰 재사용 거부
- 다른 사용자의 토큰으로 다른 계정 비밀번호 변경 시도 차단

---

#### A2. 이메일 인증
**문제**: 가입 시 이메일 검증 없음 → 오타 주소로 가입하면 비밀번호 재설정도 못 받음.

**구현**:
1. `app_user.emailVerifiedAt` (timestamp nullable) 컬럼 추가
2. 가입 직후 verification 메일 발송 (A1 인프라 재사용)
3. `email_verification_token` 테이블 (재사용 가능한 single-use 토큰)
4. `GET /api/auth/email/verify?token=...` → DB update + 성공 페이지로 redirect
5. UI: 미인증 사용자가 로그인 시 상단 배너 ("이메일 인증 필요. 메일 다시 받기" 버튼)
6. 점진 강제: 처음에는 경고만, 다음 PR에서 인증 안 된 계정의 특정 기능 제한

**의존**: A1 (이메일 인프라)

---

#### A3. OAuth (Google)
**구현**:
1. Provider abstraction 레이어 — `web/src/server/auth/providers/`
2. Google OAuth client 등록 + `GOOGLE_OAUTH_CLIENT_ID/SECRET`
3. `app_user_oauth` 테이블 — `userId, provider, providerUserId, accessToken (선택), createdAt`
4. `GET /api/auth/google/start` → Google authorize URL redirect
5. `GET /api/auth/google/callback` — code → token → userInfo → 신규/기존 매핑
6. UI: `/login` + `/signup`에 "Google로 계속" 버튼 (V2PrimaryBtn variant)

**고려**:
- 같은 이메일로 password 가입 + Google 가입 → 자동 link 또는 차단? **결정 필요**
- 권장: 이메일 같으면 자동 link (현재 user에 oauth row 추가). 단, password로 먼저 로그인된 상태 또는 이메일 인증 완료된 경우만.

---

#### A4. 활성 세션 목록 + 개별 종료
**구현**:
1. `auth_session` 테이블에 `userAgent text`, `ip text` 컬럼 추가 (마이그레이션)
2. `createSession`이 user-agent / IP 받아 저장
3. `GET /api/auth/sessions` — 본인 활성 세션 목록 (current 표시)
4. `DELETE /api/auth/sessions/[token]` — 특정 세션 종료
5. `DELETE /api/auth/sessions` — 모든 다른 세션 종료
6. UI: V2PasswordSheet 옆에 "활성 세션 관리" 시트 추가

**의존**: 없음. **단독 PR 가능**.

---

#### A5. 2FA (TOTP)
**구현**:
1. `app_user.totpSecret` (text nullable, 암호화 저장)
2. otplib npm 패키지 (서버 측)
3. `/api/auth/2fa/setup` → QR 코드 + secret 반환 (verify 후 활성화)
4. `/api/auth/2fa/verify` → 6자리 코드 검증
5. 로그인 흐름 분기: 2FA 활성화된 사용자는 1차(password) 후 2차(TOTP) 단계
6. 백업 코드 (10개) 일회용

**의존**: 안정적인 인증 흐름 (현재 충분).

---

#### A6. 계정 삭제
**구현**:
1. `DELETE /api/auth/account` — body에 비밀번호 재확인 필수
2. cascade: 트랜잭션 내에서 user_id 매칭되는 모든 도메인 row 삭제 + app_user row 삭제 + 세션 삭제
3. 시드 데이터(`exercise`, `exerciseAlias`, `programTemplate` PUBLIC)는 보존
4. UI: MoreSheet → "계정 설정" 시트 → 위험 영역 카드 → "계정 영구 삭제" (이중 확인)

**스코프**: A4와 같은 PR로 묶을 만함 (둘 다 세션 관리 영역).

---

### B. 본 운동기록 화면 v2 통합

#### B1. WorkoutSessionContent v2 카드 스타일 (P0)
**문제**: 키패드 시트는 v2지만, 메인 폼은 여전히 기존 컴포넌트 스타일. 토큰 매핑으로 색감만 v2 톤.

**구현 단계**:
1. **현재 구조 파악** — `web/src/features/workout-log/ui/workout-session-content.tsx` (또는 그 하위 트리)
2. **운동 카드 컴포넌트 추출** — `WorkoutExerciseCardV2`
   - 헤더: 운동명 + 메뉴 (재정렬, 삭제, 메모)
   - 메트릭 행: 권장 무게 / 권장 reps / 1RM%
   - 세트 그리드: V2Card inset, 각 세트 셀 클릭 → 키패드 시트로 jump (해당 set 활성)
3. **세션 헤더 v2** — 날짜 + 플랜명 + 진행률 (% 또는 N/M sets)
4. **CTA bottom bar v2** — 저장 버튼을 V2PrimaryBtn full로
5. **인라인 picker / 메뉴 시트** v2 sheet 패턴으로 교체

**리스크**:
- 깊은 atom/controller wiring 손상 가능 → 기존 파일 백업 후 점진 교체
- E2E 테스트 부재 → 수동 QA 시나리오 작성 필수 (`web/docs/qa-test-guide.md` 활용)

**대안**:
- 점진 PR — 헤더만 → 카드만 → CTA만, 세 PR로 분할

---

#### B2. RPE 입력 슬롯
**문제**: 메인 화면에 RPE 입력 UI가 없음. 키패드 오버레이는 RPE 입력 가능하지만 메인 폼이 없으니 set 단위 RPE 저장 안 됨.

**구현**:
1. `WorkoutProgramExerciseEntryState`에 `rpeInputs: string[]` 추가
2. `programEntryStateAtom` migration logic
3. 운동 카드의 각 세트 셀에 RPE 입력 슬롯 (작은 input or chip toggle)
4. 저장 시 `payload.sets[].rpe`에 매핑 (이미 `workoutSet.rpe` 컬럼 존재)
5. USER 운동의 경우 `set.rpePerSet?` 추가 검토

**의존**: B1과 같은 PR로 묶음 권장.

---

#### B3. 휴식 타이머 햅틱 / 사운드
**구현**:
1. 휴식 타이머 종료 (default 3분) 시점에 햅틱 — `navigator.vibrate([200, 100, 200])`
2. 옵션: 짧은 알림음 (사용자 설정으로 on/off)
3. 백그라운드 탭에서 동작? — Service Worker로 push notification (별도 PR)

**스코프**: 작음. B시리즈 안에서 처리.

---

### C. 통계 / 진행 화면 v2

#### C1. /stats 페이지 v2 (P1)
**현재**: 토큰 매핑으로 색감만 v2. 레이아웃은 기존.

**구현**:
1. v2 디자인 파일 참조: 원본 `irongraph-design-system/project/v2/Today.jsx` 의 ProgressDeck + `Detail.jsx` 의 ChartLarge
2. 운동 picker (가로 스와이프 chip) → 선택 시 그 운동의 1RM 추이
3. 큰 1RM 카드 (현재 1RM, 8주 변화량, area chart)
4. 리프트별 진행 카드 (current / improvement / micro spark)
5. 주간 볼륨 bar chart
6. 데이터 소스: 기존 `/api/stats/*` endpoints (어떤 것이 있는지 확인 필요)

**기술 메모**:
- SVG chart는 `v2-home-dashboard.tsx`의 `BigChart`/`MicroSpark` 재사용 가능
- 기존 chart 라이브러리 사용 중이면 의존성 점검

---

#### C2. 운동 상세 페이지 v2
**구현**: `irongraph-design-system/project/v2/Detail.jsx` 그대로 이식
- 라우트: `/exercises/[exerciseId]` 신규
- 히어로 1RM + ChartLarge (PR 마커 포함)
- 메트릭 카드 3개 (세션, 총 볼륨, 평균 RPE)
- 4개 탭 (요약 / 히스토리 / 세트 로그 / 노트)
- 진입 경로: 홈 Today deck 최근 PR 카드, LibrarySheet 운동 카드, 키패드 picker 길게 누름

**의존**: 운동별 stats API 필요 — 기존 `/api/stats`가 있다면 활용, 없으면 신규.

---

#### C3. PR 히스토리 전용 화면
**구현**:
- `/stats/prs` 신규
- 시간순 PR 목록 (운동, 세트, 무게, EST 1RM, 날짜)
- 운동별 필터
- 진입: 홈 Today deck 최근 PR "모두 보기 →" 링크

---

### D. 백업 / 복원

#### D1. JSON / CSV export-import (P1)
**현재**: `/api/exercises/export` 정도만 있음 (확인 필요).

**구현**:
1. **Export**:
   - `GET /api/me/export` — 사용자의 모든 plan/log/setting/progression을 JSON 한 번에
   - 응답 헤더 `Content-Disposition: attachment`
   - JSON 스키마 버전 명시 (`schemaVersion: 1`)
2. **Import**:
   - `POST /api/me/import` — JSON multipart 또는 raw body
   - 검증 (스키마 버전, 무결성), trial dry-run 모드
   - **충돌 정책**: replace (전체 삭제 후 import) / merge (id 충돌 시 skip) — 사용자 선택
3. UI: MoreSheet → "데이터" → 시트
   - "내보내기" 버튼 → 다운로드
   - "가져오기" → 파일 선택 → 미리보기 카운트 → 확인 후 진행
4. 프라이버시: 다른 사용자 데이터 leak 방지 — server에서 user_id 강제

**스코프**: 단독 PR. 마이그레이션 도구로도 활용 가능 (env userId → uuid 사용자 간).

---

#### D2. 온보딩 데이터 import
**구현**: D1의 import API 재사용. 온보딩 step 5 (선택)로 "기존 데이터 가져오기" 추가.

---

### E. 운영 / 인프라

#### E1. Rate limit Redis 분산
**현재**: in-memory, 단일 인스턴스 가정.

**구현**:
1. Upstash Redis (HTTP API → edge runtime 호환) 또는 일반 Redis
2. `web/src/server/auth/rate-limit.ts`를 인터페이스화 (`InMemoryRateLimit` / `RedisRateLimit`)
3. 환경변수 `REDIS_URL` 있으면 자동 분기
4. 키 형식 `ratelimit:<key>` + `INCR` + `EXPIRE`

**의존**: 멀티 인스턴스 배포 결정 시 필수. Vercel에서 dev 단일 인스턴스라면 보류 가능.

---

#### E2. 인증 이벤트 로깅
**구현**:
1. `auth_event_log` 테이블 (`id, userId?, eventType, ip, userAgent, success, createdAt, meta jsonb`)
2. `eventType`: SIGNUP, LOGIN, LOGIN_FAIL, LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET_REQUEST, PASSWORD_RESET_CONFIRM
3. 모든 auth API에 hook
4. `/api/me/security/events` — 본인 이벤트 목록 (지난 30일)
5. UI: 활성 세션 목록 시트 (A4) 안에 "최근 보안 활동" 섹션

---

#### E3. CLAUDE.md 업데이트
**필요**:
- "싱글 유저, OAuth 없음" 라인 → "이메일/패스워드 인증, env fallback 유지" 로 교체
- 신규 라우트 (`/login`, `/signup`, `/onboarding`, `/workout/log/keypad`) 추가
- 신규 API 군 (`/api/auth/*`, `/api/ops/sessions/*`, `/api/logs/calendar`) 추가
- v2 디자인 시스템 진입점 (`v2-tokens.css`, `web/src/components/v2/`) 명시

---

### F. 테스트 / QA

#### F1. E2E 테스트 (Playwright) — 인증 흐름
**시나리오**:
- 신규 가입 → 자동 로그인 → 홈 진입
- 로그인 실패 시 에러 표시
- 로그아웃 → /login 진입 → 로그인 → 홈 복귀
- 미인증 상태에서 보호 라우트 → /login redirect (next 파라미터)
- 비밀번호 변경 → 모든 세션 무효화 (별도 브라우저로 검증)
- Rate limit 초과 → 429

**파일**: `web/tests/e2e/auth.spec.ts` (기존 e2e 디렉토리 확인 후)

---

#### F2. v2 키패드 + PR 흐름 E2E
**시나리오**:
- 빠른 기록 → 운동명 + 세트 입력 → 저장 → 세션 요약 PR 카드 표시
- 메인 화면 키패드 시트 → atom 양방향 동기화 검증
- 캘린더 빈 날짜 → /workout/log?date=... 진입

---

## 3. 권장 순서 (스프린트 단위)

### Sprint 1 (보안 잠금 — 1주)
1. **A1** 비밀번호 재설정 + 이메일 인프라 (Resend 통합)
2. **A2** 이메일 인증
3. **E2** 인증 이벤트 로깅
4. **E3** CLAUDE.md 업데이트

→ 산출물: 사용자가 비밀번호 잊어도 복구 가능, 이메일 진위 확인, 보안 활동 추적.

### Sprint 2 (v2 시각 일관성 — 1.5주)
1. **B1** 본 운동기록 화면 v2 카드 + **B2** RPE 슬롯
2. **C1** /stats 페이지 v2
3. **C2** 운동 상세 페이지 v2
4. **F2** v2 흐름 E2E

→ 산출물: 모든 핵심 화면이 v2 디자인 일관성. 통계/상세도 동일 톤.

### Sprint 3 (데이터 안전성 + 사용자 관리 — 1주)
1. **D1** export/import
2. **A4** 활성 세션 목록 + **A6** 계정 삭제
3. **F1** 인증 E2E

→ 산출물: 데이터 백업 가능, 사용자가 본인 보안 상태 확인 가능, 계정 정리 가능.

### Sprint 4 (확장성 — 선택, 멀티 인스턴스 배포 시)
1. **E1** Rate limit Redis
2. **A3** Google OAuth
3. **A5** 2FA

---

## 4. 즉시 시작 가이드 (다음 세션 onboarding)

새 세션 시작 시 권장 순서:

```bash
# 1. 변경 컨텍스트 확인
cat web/docs/v2-next-pr-plan.md

# 2. 직전 세션 변경 요약 (git log)
git log --oneline -20

# 3. 현재 마이그레이션 상태
ls web/src/server/db/migrations/

# 4. 빌드 검증
cd web && pnpm tsc --noEmit
```

### Sprint 1 시작 체크리스트 (비밀번호 재설정)

- [ ] Resend 계정 + API key (`RESEND_API_KEY`)
- [ ] 발송 도메인 SPF/DKIM 설정 (운영 시)
- [ ] DB schema에 `password_reset_token` 추가 → `pnpm db:generate` → 마이그레이션 검토
- [ ] `web/src/server/email/sender.ts` (Resend SDK 또는 fetch)
- [ ] `web/src/server/auth/reset-token.ts` (생성, 검증, 마킹)
- [ ] API 3개 (`request`, `confirm`, `verify` for A2)
- [ ] UI 페이지 2개 (`/forgot-password`, `/reset-password`)
- [ ] `/login`에 "비밀번호 분실?" 링크
- [ ] 이메일 템플릿 (한/영) — 별도 파일 또는 inline
- [ ] Rate limit (request: IP당 시간당 3회, email당 시간당 3회)
- [ ] E2E 1개 (가입 → 로그아웃 → 비밀번호 분실 요청 → 메일에서 토큰 추출 → 새 비밀번호 → 로그인)

---

## 5. 알려진 트랩 / 주의사항

### 5.1 마이그레이션 충돌
- `db:generate`가 만든 SQL을 항상 검토 후 적용. 자동 생성된 인덱스 이름이 기존과 충돌 가능.
- 0015 마이그레이션 (app_user, auth_session)은 **운영에서 한 번만 적용** 필요. 이미 dev 환경에서 적용된 상태일 수 있음.

### 5.2 dev 호환성
- `WORKOUT_AUTH_USER_ID` 환경변수가 셋팅되어 있으면 미들웨어가 인증 우회. 가입 흐름 테스트 시 unset 필요.
- 새 사용자가 첫 로그인 시 데이터가 비어 있음 → V2OnboardingRedirect가 `/onboarding`으로 이동하는데, dev userId의 데이터가 있으면 `hasExistingData=true`라 안 돌아감. claim 옵션으로 가져왔다면 OK.

### 5.3 키패드 + 메인 화면 wiring
- 키패드 시트의 atom write가 메인 폼에 즉시 반영되는지 양방향 검증. React 18 자동 batch로 인해 한 박자 늦게 보일 수 있음.
- USER 운동의 weight 변경 시 모든 세트가 같은 무게로 업데이트됨 (의도). 세트별 다른 무게 입력은 USER source의 model 변경 필요.

### 5.4 PR 매칭 비용
- `detectPersonalRecords`가 사용자의 모든 이전 세트를 스캔. 데이터가 매우 많으면 (>10k sets) latency 영향 가능. 향후 user별 best e1RM materialized view 또는 캐시 도입 고려.

### 5.5 cookie 설정
- `secure: process.env.NODE_ENV === "production"` — 운영에서만 secure cookie. localhost 개발 시 secure=false로 동작.
- SameSite=lax — third-party iframe에서 cookie 전송 안 됨 (의도된 CSRF 방어).

### 5.6 v2 토큰 오버라이드
- `v2-overrides.css`가 모든 기존 `--color-*` 토큰을 v2 톤으로 매핑. 새 컴포넌트는 가능하면 `--v2-*` 토큰 직접 사용. 기존 컴포넌트 점진 마이그레이션 시 매핑 의존.

---

## 6. 참고 파일 인덱스

### 디자인
- 원본 v2: `(외부 다운로드, /tmp/design-fetch/extracted/irongraph-design-system/)` — 다음 세션 시 다시 fetch 필요할 수 있음. 핵심 컴포넌트는 이미 `web/src/components/v2/`에 이식됨.
- v2 토큰: [web/src/styles/v2-tokens.css](../src/styles/v2-tokens.css)
- 글로벌 오버라이드: [web/src/styles/v2-overrides.css](../src/styles/v2-overrides.css)

### 인증
- DB: `app_user`, `auth_session` in [schema.ts](../src/server/db/schema.ts)
- 헬퍼: [password.ts](../src/server/auth/password.ts), [session.ts](../src/server/auth/session.ts), [user.ts](../src/server/auth/user.ts), [rate-limit.ts](../src/server/auth/rate-limit.ts), [origin.ts](../src/server/auth/origin.ts), [claim-fallback.ts](../src/server/auth/claim-fallback.ts)
- API: `web/src/app/api/auth/{signup,login,logout,me,password}/route.ts`
- 미들웨어: [middleware.ts](../src/middleware.ts)
- UI: [v2-auth-form.tsx](../src/components/v2/v2-auth-form.tsx), [v2-password-sheet.tsx](../src/components/v2/v2-password-sheet.tsx)

### v2 화면
- 홈: [v2-home-dashboard.tsx](../src/components/v2/v2-home-dashboard.tsx)
- ActionDock: [v2-bottom-nav.tsx](../src/components/v2/v2-bottom-nav.tsx)
- 시트: [v2-plan-sheet.tsx](../src/components/v2/v2-plan-sheet.tsx), [v2-library-sheet.tsx](../src/components/v2/v2-library-sheet.tsx), [v2-more-sheet.tsx](../src/components/v2/v2-more-sheet.tsx)
- 키패드: [v2-keypad-overlay.tsx](../src/components/v2/v2-keypad-overlay.tsx) (메인 화면 시트), [v2-keypad-quick-log.tsx](../src/components/v2/v2-keypad-quick-log.tsx) (빠른 기록 페이지)
- 세션 요약: [v2-session-summary.tsx](../src/components/v2/v2-session-summary.tsx)
- 온보딩: [v2-onboarding.tsx](../src/components/v2/v2-onboarding.tsx) + [v2-onboarding-redirect.tsx](../src/components/v2/v2-onboarding-redirect.tsx)

### 운영
- Sessions prune: [api/ops/sessions/prune/route.ts](../src/app/api/ops/sessions/prune/route.ts) — `WORKOUT_OPS_TOKEN` 환경변수
- Calendar: [api/logs/calendar/route.ts](../src/app/api/logs/calendar/route.ts)

---

## 7. 한계 + 비-범위

### 이 문서가 다루지 않는 것
- **모바일 native (iOS/Android)** — PWA로 충분
- **다국어 추가 (영/한 외)** — 별도 i18n 스프린트
- **결제 / 구독** — 본 앱은 개인용
- **AI 코칭** — 별도 프로젝트
- **소셜 기능** (팔로우/공유) — 본 앱 의도적 회피

### 유보된 의사결정
- **OAuth 자동 link 정책** (A3): 같은 이메일이면 자동 link 권장 (verified 조건). 사용자 확인 필요.
- **데이터 import 충돌 정책** (D1): replace 기본 / merge 옵션 — UI에서 명시.
- **Rate limit 기준 강화 시점** (E1): 현재 rate가 충분한지 운영 데이터로 판단 후 조정.

---

> **다음 세션 시작 시 이 문서 첫 줄 "현재 상태 요약" → "1. 우선순위 매트릭스" → "Sprint 1 시작 체크리스트" 순서로 읽고 진행할 것.**
