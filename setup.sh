#!/usr/bin/env bash
# setup.sh — Local contributor bootstrap for vue-plugin-hiprint v2.0.0 (V3).
#
# Installs dependencies, runs typecheck + Vitest unit suite, and prints the
# next-step commands. Pair with setup.ps1 for Windows PowerShell users.
#
# Usage:
#   ./setup.sh             # full bootstrap
#   ./setup.sh --skip-tests  # install + typecheck only (faster)
#   ./setup.sh --help
#
# See docs/QUICK-START.md §3 for full contributor workflow.

set -euo pipefail

# ---------- Args ----------
SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      echo "Try ./setup.sh --help" >&2
      exit 1
      ;;
  esac
done

# ---------- Pretty print ----------
log()  { printf '\033[1;36m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- Node version check ----------
log 'Checking Node.js version (need >= 18)...'
if ! command -v node >/dev/null 2>&1; then
  fail 'Node.js not found. Install Node.js >= 18 from https://nodejs.org/'
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  fail "Node.js >= 18 required (found $(node -v)). See engines.node in package.json."
fi
log "Node.js $(node -v) OK"

# ---------- npm check ----------
if ! command -v npm >/dev/null 2>&1; then
  fail 'npm not found. It ships with Node.js — reinstall Node.js >= 18.'
fi
log "npm $(npm -v) OK"

# ---------- Install deps ----------
log 'Installing dependencies (npm install)...'
npm install

# ---------- Typecheck ----------
log 'Running TypeScript strict check (npm run typecheck)...'
npm run typecheck

# ---------- Unit tests ----------
if [ "${SKIP_TESTS}" -eq 1 ]; then
  warn 'Skipping unit tests (--skip-tests).'
else
  log 'Running Vitest unit suite (npm run test:unit)...'
  npm run test:unit
fi

# ---------- Done ----------
printf '\n'
log 'All checks passed.'
printf '\n'
printf 'Next steps:\n'
printf '  npm run dev           # start Vite dev server (http://localhost:5173)\n'
printf '  npm run test:unit:watch  # Vitest in watch mode\n'
printf '  npm run test:e2e      # Playwright e2e suite (19 specs)\n'
printf '  npm run pack:fixed    # build + npm pack → vue-plugin-hiprint.tgz\n'
printf '\n'
printf 'Docs:\n'
printf '  docs/QUICK-START.md      — consumer + contributor quick start\n'
printf '  docs/upgrade-to-v3.md    — V1 -> V3 migration guide\n'
printf '  docs/API-REFERENCE.md    — public API surface\n'
printf '  docs/CODE-BLUEPRINT.md   — repository code map\n'
printf '\n'
