#!/usr/bin/env bash
# Smoke tests for bin/orc-stage — packs, validate, render, run stub.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
stage="$repo_root/orc/bin/orc-stage"
fx="$repo_root/scripts/ci/fixtures/factory"
packs="$repo_root/orc/factory/stages.json"

status=0
fail() { echo "verify-stage: FAIL - $1"; status=1; }
pass_count=0
ok() { pass_count=$((pass_count + 1)); }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

run() { bash "$stage" "$@"; }

# --- packs -------------------------------------------------------------------
out="$(run packs 2>&1 || true)"
if [ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" = 8 ]; then ok; else fail "packs: expected 8 lines"; fi
want="$(jq -r '.packs | keys_unsorted | join(" ")' "$packs")"
got="$(printf '%s\n' "$out" | cut -f1 | tr '\n' ' ' | sed 's/ $//')"
if [ "$got" = "$want" ]; then ok; else fail "packs: ids/order '$got' != '$want'"; fi
if printf '%s\n' "$out" | awk -F'\t' '$1=="implementing" && $2=="orc-implementer" && $3=="true" && $4 ~ /^Read,/ {f=1} END{exit !f}'; then ok; else fail "packs: implementing line malformed"; fi
if printf '%s\n' "$out" | awk -F'\t' '$1=="evidence" && $2=="script" && $3=="false" {f=1} END{exit !f}'; then ok; else fail "packs: evidence must show 'script'"; fi

# --- validate ----------------------------------------------------------------
for f in stage-input.example.json stage-input.noplan.json; do
  if run validate --input "$fx/$f" >/dev/null 2>&1; then ok; else fail "validate --input rejects $f"; fi
done
if run validate --output "$fx/stage-output.example.json" >/dev/null 2>&1; then ok; else fail "validate --output rejects example"; fi
err="$(run validate --input "$fx/stage-input.broken.json" 2>&1 >/dev/null)" && rc=0 || rc=$?
if [ "$rc" = 1 ] && [ -n "$err" ]; then ok; else fail "validate --input broken: rc=$rc err='$err'"; fi
err="$(run validate --output "$fx/stage-output.broken.json" 2>&1 >/dev/null)" && rc=0 || rc=$?
if [ "$rc" = 1 ] && [ -n "$err" ]; then ok; else fail "validate --output broken: rc=$rc err='$err'"; fi
if run validate --packs >/dev/null 2>&1; then ok; else fail "validate --packs rejects stages.json"; fi
run validate >/dev/null 2>&1 && rc=0 || rc=$?
if [ "$rc" = 2 ]; then ok; else fail "validate without args: rc=$rc, want 2"; fi

# --- render ------------------------------------------------------------------
rich="$tmp/rich.json"
jq '.task.title="Add CSV export"|.task.criteria=["handles a/b & c","exports UTF-8"]
  |.plan={"brief":"Build the exporter","criteria":["c1"],"assumptions":["a1"]}
  |.decisions=[{"at":"awaiting_approval","decision":"approved","reason":"looks good","answers":{}}]
  |.priorFindings=[{"severity":"major","path":"src/a.ts","line":7,"title":"leaks"}]
  |.context.projectContext="Uses pnpm"' "$fx/stage-input.example.json" > "$rich"
r="$(run render implementing "$rich")"
for needle in "Add CSV export" "- handles a/b & c" "- exports UTF-8" "orc-implementer" "ORC_FACTORY=1" \
  "Build the exporter" "- approved at awaiting_approval: looks good" "- major src/a.ts:7 leaks" "Uses pnpm"; do
  if printf '%s' "$r" | grep -qF -- "$needle"; then ok; else fail "render: missing '$needle'"; fi
done
size="$(run render implementing "$fx/stage-input.example.json" | wc -c | tr -d ' ')"
if [ "$size" -lt 6144 ]; then ok; else fail "render: example is $size bytes (>= 6144)"; fi
np="$(run render implementing "$fx/stage-input.noplan.json")"
if printf '%s' "$np" | grep -qF "(none)"; then ok; else fail "render: null plan must render (none)"; fi
if printf '%s' "$np" | grep -qF "{{"; then fail "render: unreplaced placeholder"; else ok; fi
run render nope "$fx/stage-input.example.json" >/dev/null 2>&1 && rc=0 || rc=$?
if [ "$rc" = 2 ]; then ok; else fail "render unknown pack: rc=$rc, want 2"; fi

# custom template via ORC_FACTORY_STAGES
printf 'CUSTOM {{task.title}} / {{attempt}} / {{agent}}\n' > "$tmp/t.md"
jq --arg t "$tmp/t.md" '.packs.implementing.promptTemplate=$t' "$packs" > "$tmp/stages.json"
c="$(ORC_FACTORY_STAGES="$tmp/stages.json" run render implementing "$rich")"
if printf '%s' "$c" | grep -qF "CUSTOM Add CSV export / 1 / orc-implementer"; then ok; else fail "render: custom template not used"; fi

# --- run stub ----------------------------------------------------------------
run run >/dev/null 2>&1 && rc=0 || rc=$?
if [ "$rc" = 3 ]; then ok; else fail "run stub: rc=$rc, want 3"; fi

[ "$status" = 0 ] || exit 1
echo "verify-stage: OK ($pass_count checks)"
