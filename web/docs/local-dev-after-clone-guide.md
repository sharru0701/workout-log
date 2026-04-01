# Git Clone 직후 로컬 개발 가이드

## 0) 대상 경로
개발 대상은 `web` 앱이지만, 로컬 실행 명령은 저장소 루트에서 시작합니다.

```bash
git clone <repo-url>
cd workout-log
```

## 1) 빠른 시작 (루트에서 1줄, Docker 권장)
사전 조건:
- Docker Desktop 또는 Docker Engine + Compose plugin 설치

실행:

```bash
./dev up
```

접속:
- 앱: `http://localhost:3000`
- DB: `127.0.0.1:5432` (`app/app`, DB명 `workoutlog`)

종료:

```bash
./dev down
```

처음 데이터까지 자동 준비하고 싶다면:

```bash
RUN_DB_SEED=1 ./dev up
```

## 2) Docker 없이 실행
사전 조건:
- Node.js (프로젝트 권장 버전)
- pnpm
- Postgres 16+

`.env.local` 예시 (Vercel 환경과 동일하게 풀러 분리):

```bash
DATABASE_URL="postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-[리전].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-[리전].pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_APP_URL=http://localhost:3000
WORKOUT_AUTH_USER_ID=local-user
NEXT_PUBLIC_DISABLE_SW=1
```

실행:

```bash
pnpm run dev:check
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

기본 `pnpm db:seed`는 템플릿/운동 카탈로그만 세팅합니다. 검증용 샘플 플랜까지 넣고 싶으면 `pnpm db:seed:demo-plans`를 사용하세요.

## 3) 자주 막히는 포인트
- `5432` 충돌 시: `WEB_PORT=3001 POSTGRES_PORT=5433 ./dev up`
- 컨테이너 재시작 후 이상할 때: `./dev down` 후 `./dev up`
- DB 데이터까지 초기화: `./dev down:volumes`

## 4) 형상관리(버전관리) 가능 여부
가능합니다. 현재 구조는 Git으로 형상관리하기에 문제 없습니다.

팀 공통 규칙은 아래 문서를 기준으로 맞추세요.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)

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
- `docker-compose.dev.yml`, `Dockerfile.dev`, `scripts/docker-dev-start.sh` 같은 개발환경 파일은 커밋해서 팀이 동일 환경을 재현하도록 유지합니다.

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
