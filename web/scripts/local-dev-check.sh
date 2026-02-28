#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_DIR"

ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1"; }

echo "== Workout Log local-dev check =="

if command -v node >/dev/null 2>&1; then
  ok "node: $(node -v)"
else
  fail "node is not installed"
fi

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm: $(pnpm -v)"
else
  fail "pnpm is not installed"
fi

if [ -f ".env.local" ]; then
  ok ".env.local exists"
else
  warn ".env.local is missing (create it before running the app)"
fi

if getent hosts registry.npmjs.org >/dev/null 2>&1; then
  ok "DNS lookup for registry.npmjs.org works"
else
  fail "DNS lookup for registry.npmjs.org failed"
fi

if [ -d "node_modules" ] && [ -x "node_modules/.bin/next" ]; then
  ok "dependencies look installed"
else
  fail "dependencies are not fully installed (run: pnpm install)"
fi

if command -v docker >/dev/null 2>&1 && docker --version >/dev/null 2>&1; then
  ok "docker: $(docker --version)"
else
  warn "docker is not available in this WSL distro"
fi

if (echo > /dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then
  ok "Postgres is reachable on 127.0.0.1:5432"
else
  warn "Postgres is not reachable on 127.0.0.1:5432"
fi

echo
echo "Suggested next commands:"
echo "  pnpm install"
echo "  pnpm db:migrate"
echo "  pnpm db:seed"
echo "  pnpm dev"
