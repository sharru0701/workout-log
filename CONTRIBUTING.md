# Contributing Guide

## 1) 작업 위치
기본 개발 대상은 `web` 앱입니다.

```bash
cd web
```

`git clone` 직후 로컬 세팅은 아래 문서를 먼저 확인하세요.
- [`web/docs/local-dev-after-clone-guide.md`](./web/docs/local-dev-after-clone-guide.md)

## 2) 브랜치 전략
기능/수정 단위로 브랜치를 분리합니다.

권장 네이밍:
- `feat/<short-topic>`
- `fix/<short-topic>`
- `chore/<short-topic>`
- `docs/<short-topic>`

예시:

```bash
git checkout -b docs/local-dev-onboarding
```

## 3) 커밋 규칙
작은 단위로 나누고, 메시지는 변경 의도가 드러나게 작성합니다.

권장 포맷:
- `feat: ...`
- `fix: ...`
- `chore: ...`
- `docs: ...`

예시:

```bash
git add web/docs/local-dev-after-clone-guide.md web/README.md
git commit -m "docs: add post-clone local dev onboarding guide"
```

## 4) PR 전 체크
PR 올리기 전에 최소 아래를 확인하세요.

```bash
cd web
pnpm lint
pnpm db:migrate
```

필요 시:

```bash
pnpm db:seed
pnpm test:e2e
```

## 5) 금지/주의 사항
- `.env.local` 등 비밀값 파일은 커밋하지 않습니다.
- 대용량 산출물(`.next`, `node_modules`)은 커밋하지 않습니다.
- 개발환경 재현에 필요한 파일(`docker-compose.dev.yml`, `Dockerfile.dev`, `scripts/docker-dev-start.sh`)은 커밋 대상입니다.
