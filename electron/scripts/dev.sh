#!/usr/bin/env sh
set -e

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
RENDERER_DIR="$ROOT/renderer"
ELECTRON_DIR="$ROOT/electron"

RENDERER_PID=""
cleanup() {
  if [ -n "$RENDERER_PID" ] && kill -0 "$RENDERER_PID" 2>/dev/null; then
    kill "$RENDERER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[dev] starting renderer dev server..."
(
  cd "$RENDERER_DIR"
  npm run dev
) &
RENDERER_PID=$!

echo "[dev] waiting for renderer on http://localhost:3000 ..."
READY=0
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null http://localhost:3000; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "[dev] renderer did not become ready on http://localhost:3000" >&2
  exit 1
fi

echo "[dev] renderer ready; building + launching electron..."
cd "$ELECTRON_DIR"
npm run build
npx electron .