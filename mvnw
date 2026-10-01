#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -n "${REVENUE_JAVA_HOME:-}" ]]; then
  export JAVA_HOME="$REVENUE_JAVA_HOME"
elif [[ -d .tools/jdk-11.0.32.1+1/Contents/Home ]]; then
  export JAVA_HOME="$PWD/.tools/jdk-11.0.32.1+1/Contents/Home"
fi
if command -v mvn >/dev/null 2>&1; then
  exec mvn -Dmaven.repo.local="$PWD/.build-cache/m2" "$@"
fi
if [[ ! -x .tools/apache-maven-3.9.11/bin/mvn ]]; then
  mkdir -p .tools
  curl -fL https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.tar.gz -o .tools/maven.tar.gz
  tar -xzf .tools/maven.tar.gz -C .tools
fi
exec .tools/apache-maven-3.9.11/bin/mvn -Dmaven.repo.local="$PWD/.build-cache/m2" "$@"
