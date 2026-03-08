#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="$IOS_DIR/SafariCaptureExtensionSeed"
OUT_DIR="$IOS_DIR/ToThreadCaptureApp"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "error: xcodebuild not found. Install Xcode first."
  exit 1
fi

if ! xcrun -f safari-web-extension-converter >/dev/null 2>&1; then
  echo "error: safari-web-extension-converter unavailable. Full Xcode is required (Command Line Tools is not enough)."
  exit 1
fi

if [ -d "$OUT_DIR" ]; then
  echo "error: output directory already exists: $OUT_DIR"
  echo "Delete it first if you want to regenerate."
  exit 1
fi

xcrun safari-web-extension-converter "$SEED_DIR" \
  --project-location "$OUT_DIR" \
  --app-name "ToThreadCapture" \
  --bundle-identifier "com.zhian.tothread.capture" \
  --swift

echo "Created project at: $OUT_DIR"
echo "Next: open in Xcode, set team/signing, build for iPhone device."
