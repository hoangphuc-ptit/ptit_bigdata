#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_ROOT/scripts/java-env.sh"
cd "$PROJECT_ROOT"
tool=RevenueTool
if [[ "${1:-}" == "--tool" ]]; then tool="${2:?Missing tool}"; shift 2; fi
case "$tool" in RevenueTool|DatasetTool) ;; *) echo "Unknown tool: $tool" >&2; exit 2;; esac
if [[ ! -f target/revenue-aggregation.jar ]]; then ./mvnw package -DskipTests; fi
if [[ ! -f .build-cache/classpath.txt || pom.xml -nt .build-cache/classpath.txt ]]; then
  ./mvnw dependency:build-classpath -DincludeScope=compile -Dmdep.outputFile=.build-cache/classpath.txt
  touch .build-cache/classpath.txt
fi
exec "$JAVA_BIN" -cp "target/revenue-aggregation.jar:$(cat .build-cache/classpath.txt)" "vn.edu.bigdata.revenue.cli.$tool" -Dmapreduce.framework.name=local -Dfs.defaultFS=file:/// "$@"
