#!/usr/bin/env bash
# Smoke tests for bin/orc-stage — packs, validate, render, run (dry-run).
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

# --- run (dry-run; no model call) --------------------------------------------
export PATH="/opt/homebrew/bin:$PATH"
plugin_root="$repo_root/orc"
o1="$tmp/out1"
dry="$(cd "$tmp" && run run --dry-run --in "$fx/stage-input.example.json" --out "$o1" 2>&1)" && rc=0 || rc=$?
if [ "$rc" = 0 ]; then ok; else fail "run --dry-run: rc=$rc ($dry)"; fi
opts="$(printf '%s' "$dry" | jq -c . 2>/dev/null || true)"
want_tools="$(jq -c '.packs.implementing.tools' "$packs")"
if [ -n "$opts" ] && printf '%s' "$opts" | jq -e --arg r "$plugin_root" --argjson t "$want_tools" '
  (.plugins[0].path | endswith($r)) and .plugins[0].type == "local" and .settingSources == []
  and .tools == $t and .allowedTools == $t and .permissionMode == "dontAsk"
  and .env.ORC_FACTORY == "1" and .outputFormat.type == "json_schema"' >/dev/null; then ok; else fail "run --dry-run: options JSON wrong: $dry"; fi
if run validate --output "$o1/result.json" >/dev/null 2>&1; then ok; else fail "run --dry-run: result.json invalid"; fi
if [ -f "$o1/prompt.md" ] && [ "$(wc -l < "$o1/events.jsonl" | tr -d ' ')" -ge 1 ]; then ok; else fail "run --dry-run: prompt.md/events.jsonl missing"; fi
if jq -e '.ok == true and .outcome == "pass" and .summary == "dry-run"' "$o1/result.json" >/dev/null; then ok; else fail "run --dry-run: result not pass/dry-run"; fi
if tail -n1 "$o1/events.jsonl" | jq -e '.kind == "note" and .payload.phase == "stage_end" and .payload.outcome == "pass"' >/dev/null; then ok; else fail "run: last event not stage_end"; fi

# invalid input -> exit 1
run run --dry-run --in "$fx/stage-input.broken.json" --out "$tmp/out2" >/dev/null 2>&1 && rc=0 || rc=$?
if [ "$rc" = 1 ]; then ok; else fail "run invalid input: rc=$rc, want 1"; fi

# node missing -> exit 4
nonode="$tmp/nonode"; mkdir -p "$nonode"
for t in bash jq dirname cat git mkdir tr basename; do ln -sf "$(command -v "$t")" "$nonode/$t"; done
PATH="$nonode" "$(command -v bash)" "$stage" run --dry-run --in "$fx/stage-input.example.json" --out "$tmp/out3" >/dev/null 2>&1 && rc=0 || rc=$?
if [ "$rc" = 4 ]; then ok; else fail "run without node: rc=$rc, want 4"; fi

# artifact kind inference + ledger events
o4="$tmp/out4"; mkdir -p "$o4/files/tests" "$o4/files/qa"
for f in qa/qa-manifest.json qa/shot.png qa/clip.webm qa/net.har qa/report.html tests/a.test.ts x.diff findings.json rules.md notes.txt; do
  printf 'x' > "$o4/files/$f"
done
wt="$tmp/wt"; mkdir -p "$wt/.orc/feat-x/files"
git -C "$wt" init -q -b feat/x
printf '{"at":"t","agent":"orc-implementer","model":null,"in":1,"out":2,"ms":3}\n' > "$wt/.orc/feat-x/files/usage.jsonl"
jq -n '{schema:1,slices:[{id:1,title:"a",status:"committed",commit:"abc"},{id:2,title:"b",status:"green",commit:null},{id:3,title:"c",status:"escalated",commit:null},{id:4,title:"d",status:"pending",commit:null}]}' > "$wt/.orc/feat-x/files/slices.json"
(cd "$wt" && ORC_STATE_DIR="$wt/.orc" run run --dry-run --in "$fx/stage-input.example.json" --out "$o4" >/dev/null 2>&1) && rc=0 || rc=$?
if [ "$rc" = 0 ]; then ok; else fail "run artifacts: rc=$rc"; fi
kinds="$(jq -r '.artifacts[] | "\(.path)=\(.kind)"' "$o4/result.json" | sort | tr '\n' ' ')"
for w in files/findings.json=findings files/notes.txt=report files/qa/clip.webm=video files/qa/net.har=har \
  files/qa/qa-manifest.json=qa-manifest files/qa/report.html=report files/qa/shot.png=screenshot \
  files/rules.md=rules files/tests/a.test.ts=test files/x.diff=diff; do
  case " $kinds" in *" $w "*) ok ;; *) fail "artifact kind: want $w in: $kinds" ;; esac
done
if jq -e '.slices == {done:2,total:4} and (.artifacts[0].sha256|length)==64' "$o4/result.json" >/dev/null; then ok; else fail "run: slices/sha256 wrong"; fi
if [ "$(jq -c '.kind' "$o4/events.jsonl" | tr '\n' ' ')" = '"note" "slice.committed" "slice.green" "escalation" "note" ' ]; then ok; else fail "run: events kinds: $(jq -c .kind "$o4/events.jsonl" | tr '\n' ' ')"; fi
if run validate --output "$o4/result.json" >/dev/null 2>&1; then ok; else fail "run artifacts: result.json invalid"; fi

[ "$status" = 0 ] || exit 1
echo "verify-stage: OK ($pass_count checks)"
