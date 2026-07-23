# Git Clone 직후 로컬 개발 가이드

배포는 Vercel(웹앱) + Supabase(Postgres) 조합으로 운영합니다. 로컬에서는 Vercel과 동일한 환경 변수를 `.env.local`에 채워두고 Next.js dev 서버를 실행합니다.

## 0) 대상 경로
개발 대상은 `web` 앱입니다.

```bash
git clone <repo-url>
cd workout-log
```

## 1) 사전 조건
- Node.js (프로젝트 권장 버전)
- pnpm
- Postgres 16+ (로컬 인스턴스 또는 Supabase 등 원격 DB)

## 2) 환경 변수 (`web/.env.local`)
Vercel 환경과 동일하게 풀러를 분리해 두 개의 URL을 설정합니다.

```bash
DATABASE_URL="postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-[리전].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-[리전].pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_APP_URL=http://localhost:3000
WORKOUT_AUTH_USER_ID=00000000-0000-4000-8000-000000c1c1c1  # uuid만 허용 — 도메인 user_id가 app_user.id를 FK 참조, seed가 이 계정 생성
NEXT_PUBLIC_DISABLE_SW=1
```

로컬 Postgres를 직접 띄우는 경우에는 `DATABASE_URL=postgres://app:app@127.0.0.1:5432/workoutlog` 형태로 사용할 수 있습니다.

## 3) 실행

```bash
cd web
pnpm install
pnpm run dev:check
pnpm db:migrate
pnpm db:seed
pnpm dev
```

접속:
- 앱: `http://localhost:3000`

기본 `pnpm db:seed`는 템플릿/운동 카탈로그만 세팅합니다. 검증용 샘플 플랜까지 넣고 싶으면 `pnpm db:seed:demo-plans`를 사용하세요.

## 4) 형상관리(버전관리)
팀 공통 규칙은 [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)를 참고하세요.

권장 방식:
1. 기능 단위 브랜치 생성
2. 변경 파일 확인
3. 관련 파일만 스테이징
4. 의미 있는 단위로 커밋
5. PR 생성

예시:

```bash
git checkout -b docs/local-dev-onboarding
git status
git add web/docs/local-dev-after-clone-guide.md web/README.md
git commit -m "docs: add post-clone local dev onboarding guide"
git push -u origin docs/local-dev-onboarding
```

주의:
- `.env.local` 같은 로컬 비밀값 파일은 커밋하지 않습니다.

---

## 5) 운영 스케줄러 설정

### UX 이벤트 로그 보존 정리

`ux_event_log` 테이블 정리 작업을 스케줄로 실행해 저장소가 무한 증가하지 않도록 합니다.

**기본 환경 변수**:
```bash
UX_EVENTS_RETENTION_DAYS=120   # 기본 보존 기간 (일)
UX_EVENTS_CLEANUP_DRY_RUN=1    # dry-run 모드 (실제 삭제 없음)
```

**dry-run으로 먼저 확인**:
```bash
UX_EVENTS_CLEANUP_DRY_RUN=1 pnpm --dir web run db:cleanup:ux-events
```

#### Option A: Vercel Cron (현재 운영 환경)

Vercel 루트 폴더의 `vercel.json` 파일에 Cron 항목을 정의하고, 대상 서버리스 함수(API Route)를 호출하여 처리합니다.

```json
{
  "crons": [
    {
      "path": "/api/ops/cleanup",
      "schedule": "20 3 * * *"
    }
  ]
}
```
*참고: 현재 Vercel 플랫폼 통합 이후, 위와 같은 방식으로 매일 자율 정리 작업을 위임하고 있습니다.*

#### Option B: 내장 API 엔드포인트 수동 호출

관리자 계정이나 스크립트에서 보안 토큰을 담아 `/api/ops/cleanup` 엔드포인트를 직접 POST 호출하여 정리할 수도 있습니다.
