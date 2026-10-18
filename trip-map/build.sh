#!/bin/sh
# Optional native-runtime fallback. Prefer the Dockerfile on Render.
set -eu
cd "$(dirname "$0")"
(cd frontend && npm ci && npm run build)
python3 -m pip install -r backend/requirements.txt
mkdir -p backend/static
rm -rf backend/static
cp -R frontend/out backend/static
