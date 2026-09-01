#!/usr/bin/env bash
# PostToolUse hook (Write|Edit) de Arcade Vault.
# Pasa el archivo recien creado/editado por Prettier y, si es codigo JS/TS,
# por ESLint --fix. Los errores que ESLint no puede autocorregir se devuelven
# a Claude como additionalContext para que los arregle.
#
# Entrada: JSON del hook por stdin. Salida: JSON de control (o nada).
# Nunca falla de forma dura: si algo sale mal, sale 0 y deja pasar.

set -uo pipefail

PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd) || exit 0
cd "$PROJECT_ROOT" || exit 0

payload=$(cat)
raw=$(printf '%s' "$payload" | jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)
[ -n "$raw" ] || exit 0

# Windows manda rutas con backslash; normalizarlas a formato POSIX.
if command -v cygpath >/dev/null 2>&1; then
  file=$(cygpath -u "$raw" 2>/dev/null) || file="$raw"
else
  file="$raw"
fi
[ -f "$file" ] || exit 0

# Guard: actuar SOLO sobre archivos dentro de Arcade Vault.
abs=$(cd "$(dirname "$file")" && pwd)/$(basename "$file") || exit 0
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
case "$(lower "$abs")/" in
  "$(lower "$PROJECT_ROOT")"/*) ;;
  *) exit 0 ;;
esac

# No tocar dependencias ni artefactos de build.
case "$abs" in
  */node_modules/*|*/.next/*|*/.git/*|*/out/*|*/build/*) exit 0 ;;
esac

PRETTIER="$PROJECT_ROOT/node_modules/.bin/prettier"
ESLINT="$PROJECT_ROOT/node_modules/.bin/eslint"

# 1) Prettier sobre cualquier archivo que sepa formatear (tsx, ts, js, md, css,
#    json, yaml...). --ignore-unknown ignora en silencio lo que no reconoce.
[ -x "$PRETTIER" ] && "$PRETTIER" --write --ignore-unknown --log-level error "$abs" >/dev/null 2>&1

# 2) ESLint --fix solo sobre codigo JS/TS.
case "$abs" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs|*.mts|*.cts) ;;
  *) exit 0 ;;
esac
[ -x "$ESLINT" ] || exit 0

lint_out=$("$ESLINT" --fix --no-warn-ignored --format stylish "$abs" 2>&1)
lint_code=$?
[ $lint_code -eq 0 ] && exit 0

rel="${abs#"$PROJECT_ROOT"/}"
[ -n "$lint_out" ] || lint_out="ESLint salio con codigo $lint_code sin detalle."

jq -n --arg rel "$rel" --arg out "$lint_out" '{
  systemMessage: ("ESLint dejo problemas sin corregir en " + $rel),
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("Prettier formateo " + $rel + " y ESLint aplico --fix, pero quedaron problemas que requieren tu intervencion:\n\n" + $out + "\n\nCorregilos en " + $rel + " antes de continuar.")
  }
}'
exit 0
