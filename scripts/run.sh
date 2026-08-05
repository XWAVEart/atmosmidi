#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d .venv ]]; then
  uv sync
fi

if [[ ! -d frontend/dist ]]; then
  (cd frontend && npm install && npm run build)
fi

exec uv run python main.py "$@"
