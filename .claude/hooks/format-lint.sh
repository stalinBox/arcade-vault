#!/usr/bin/env bash
# PostToolUse hook (Write): formatea con Prettier y lintea con ESLint archivos creados.
# Exit 2 => errores devueltos a Claude para que los corrija.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
root=$PWD

f=$(jq -r '.tool_input.file_path // empty')
[ -n "$f" ] && [ -f "$f" ] || exit 0

# Solo archivos dentro del proyecto, excluyendo dependencias y build
case "$f" in
  "$root"/node_modules/*|"$root"/.next/*|"$root"/.claude/*) exit 0 ;;
  "$root"/*) ;;
  *) exit 0 ;;
esac

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    out=$(./node_modules/.bin/prettier --write "$f" 2>&1 >/dev/null) || { echo "$out" >&2; exit 2; }
    out=$(./node_modules/.bin/eslint --fix "$f" 2>&1) || { echo "$out" >&2; exit 2; }
    ;;
  *.md|*.mdx)
    out=$(./node_modules/.bin/prettier --write "$f" 2>&1 >/dev/null) || { echo "$out" >&2; exit 2; }
    ;;
  *) ;;
esac

exit 0
