#!/usr/bin/env bash
# Sourced by local entrypoints; changes only this process environment.
if [[ -n "${REVENUE_JAVA_HOME:-}" ]]; then
  export JAVA_HOME="$REVENUE_JAVA_HOME"
elif [[ -d "$PROJECT_ROOT/.tools/jdk-11.0.32.1+1/Contents/Home" ]]; then
  export JAVA_HOME="$PROJECT_ROOT/.tools/jdk-11.0.32.1+1/Contents/Home"
fi
JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/}java"
