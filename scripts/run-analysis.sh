#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v Rscript >/dev/null 2>&1; then
  echo "Rscript is required. Install R >= 4.2 and the jsonlite package, then rerun npm run analyze:levels." >&2
  exit 1
fi

Rscript analysis/analyze-levels.R src/levels/levels.json analysis/results
