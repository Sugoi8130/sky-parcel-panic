$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22 or newer is required. Install it, then run this script again."
}

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 22) {
  throw "Node.js 22 or newer is required. Current version: $(node --version)"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    throw "pnpm is required. Install pnpm, then run this script again."
  }
  corepack enable
  corepack prepare pnpm@latest --activate
}

pnpm install
pnpm run build
pnpm run check

Write-Host "Sky Parcel Panic is ready. Run: pnpm run dev" -ForegroundColor Green
