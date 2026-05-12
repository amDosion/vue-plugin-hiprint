#!/usr/bin/env pwsh
# setup.ps1 — Local contributor bootstrap for vue-plugin-hiprint v2.0.0 (V3).
#
# Installs dependencies, runs typecheck + Vitest unit suite, and prints the
# next-step commands. PowerShell counterpart to setup.sh.
#
# Usage:
#   ./setup.ps1               # full bootstrap
#   ./setup.ps1 -SkipTests    # install + typecheck only (faster)
#   ./setup.ps1 -Help
#
# See docs/QUICK-START.md §3 for full contributor workflow.

param(
    [switch]$SkipTests,
    [switch]$Help
)

if ($Help) {
    Get-Content $PSCommandPath -TotalCount 15 | Select-Object -Skip 1
    exit 0
}

$ErrorActionPreference = 'Stop'

function Write-Log {
    param([string]$msg)
    Write-Host "[setup] $msg" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$msg)
    Write-Host "[setup] $msg" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$msg)
    Write-Host "[setup] $msg" -ForegroundColor Red
    exit 1
}

# ---------- Node version check ----------
Write-Log 'Checking Node.js version (need >= 18)...'
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail 'Node.js not found. Install Node.js >= 18 from https://nodejs.org/'
}

try {
    $nodeMajor = [int](node -p 'process.versions.node.split(".")[0]')
} catch {
    $nodeMajor = 0
}
if ($nodeMajor -lt 18) {
    $nodeVersion = node -v
    Write-Fail "Node.js >= 18 required (found $nodeVersion). See engines.node in package.json."
}
$nodeVersion = node -v
Write-Log "Node.js $nodeVersion OK"

# ---------- npm check ----------
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Fail 'npm not found. It ships with Node.js — reinstall Node.js >= 18.'
}
$npmVersion = npm -v
Write-Log "npm $npmVersion OK"

# ---------- Install deps ----------
Write-Log 'Installing dependencies (npm install)...'
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail 'npm install failed.' }

# ---------- Typecheck ----------
Write-Log 'Running TypeScript strict check (npm run typecheck)...'
npm run typecheck
if ($LASTEXITCODE -ne 0) { Write-Fail 'typecheck failed.' }

# ---------- Unit tests ----------
if ($SkipTests) {
    Write-Warn 'Skipping unit tests (-SkipTests).'
} else {
    Write-Log 'Running Vitest unit suite (npm run test:unit)...'
    npm run test:unit
    if ($LASTEXITCODE -ne 0) { Write-Fail 'unit tests failed.' }
}

# ---------- Done ----------
Write-Host ''
Write-Log 'All checks passed.'
Write-Host ''
Write-Host 'Next steps:'
Write-Host '  npm run dev              # start Vite dev server (http://localhost:5173)'
Write-Host '  npm run test:unit:watch  # Vitest in watch mode'
Write-Host '  npm run test:e2e         # Playwright e2e suite (19 specs)'
Write-Host '  npm run pack:fixed       # build + npm pack -> vue-plugin-hiprint.tgz'
Write-Host ''
Write-Host 'Docs:'
Write-Host '  docs/QUICK-START.md      - consumer + contributor quick start'
Write-Host '  docs/upgrade-to-v3.md    - V1 -> V3 migration guide'
Write-Host '  docs/API-REFERENCE.md    - public API surface'
Write-Host '  docs/CODE-BLUEPRINT.md   - repository code map'
Write-Host ''
