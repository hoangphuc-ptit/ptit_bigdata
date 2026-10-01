#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ $# -ne 2 ]]; then echo 'Usage: prepare-input.sh INPUT_CSV_OR_DIR NEW_METADATA_DIR' >&2; exit 2; fi
input="$1"; metadata="$2"
if [[ -e "$metadata" ]]; then echo 'Metadata directory must be new' >&2; exit 2; fi
mkdir -p "$metadata"
exec "$PROJECT_ROOT/scripts/run-local.sh" --tool DatasetTool preflight --input "$input" --manifest "$metadata/input.json" --report "$metadata/preflight.json"
