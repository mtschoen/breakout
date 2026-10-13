#!/usr/bin/env bash
set -euo pipefail

build_requested=false
for argument in "$@"; do
  if [ "$argument" = "--build" ]; then
    build_requested=true
  fi
done

completed_steps=()
missing_prerequisites=()

if command -v npm >/dev/null 2>&1; then
  completed_steps+=("npm found ($(npm --version))")
else
  missing_prerequisites+=("npm (install Node.js 22+)")
fi

if command -v aislop >/dev/null 2>&1; then
  completed_steps+=("aislop found ($(aislop --version))")
else
  missing_prerequisites+=("aislop (install via: pnpm add -g aislop)")
fi

if command -v npm >/dev/null 2>&1; then
  npm install
  completed_steps+=("npm install")
fi

if command -v aislop >/dev/null 2>&1; then
  aislop hook install claude --project >/dev/null
  completed_steps+=("aislop hook install claude --project")
fi

if git ls-files --error-unmatch .claude/settings.json >/dev/null 2>&1 && \
   git diff --quiet -- .claude/settings.json 2>/dev/null && \
   git diff --cached --quiet -- .claude/settings.json 2>/dev/null && \
   [ -n "$(git status --porcelain -- .claude/settings.json 2>/dev/null)" ]; then
  git checkout -- .claude/settings.json
  completed_steps+=("normalized .claude/settings.json line endings")
fi

if command -v claude-provision >/dev/null 2>&1; then
  if claude-provision apply-project 2>/dev/null; then
    completed_steps+=("claude-provision apply-project")
  fi
fi

if [ "$build_requested" = true ] && command -v npm >/dev/null 2>&1; then
  npm run build
  completed_steps+=("npm run build")
fi

echo "Completed: ${completed_steps[*]}"
if [ "${#missing_prerequisites[@]}" -gt 0 ]; then
  echo "Missing prerequisites: ${missing_prerequisites[*]}"
fi
