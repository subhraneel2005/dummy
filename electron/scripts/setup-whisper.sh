#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/whisper.cpp"
MODELS_DIR="$ROOT/models"
MODEL="ggml-base.en.bin"
MODEL_TAG="base.en"
WHISPER_TAG="v1.7.4"

if [ ! -d "$VENDOR" ]; then
  echo "Cloning whisper.cpp ($WHISPER_TAG)…"
  git clone --depth 1 --branch "$WHISPER_TAG" https://github.com/ggml-org/whisper.cpp.git "$VENDOR"
else
  echo "whisper.cpp already present at $VENDOR"
fi

if [ ! -x "$VENDOR/build/bin/whisper-cli" ]; then
  echo "Building whisper-cli…"
  cmake -S "$VENDOR" -B "$VENDOR/build" -DCMAKE_BUILD_TYPE=Release
  cmake --build "$VENDOR/build" -j --config Release
else
  echo "whisper-cli binary already present"
fi

mkdir -p "$MODELS_DIR"

if [ ! -f "$MODELS_DIR/$MODEL" ]; then
  echo "Downloading $MODEL model…"
  ( cd "$VENDOR" && sh ./models/download-ggml-model.sh "$MODEL_TAG" )
  cp "$VENDOR/models/$MODEL" "$MODELS_DIR/$MODEL"
else
  echo "$MODEL already present"
fi

echo "Done."
echo "  binary: $VENDOR/build/bin/whisper-cli"
echo "  model:  $MODELS_DIR/$MODEL"