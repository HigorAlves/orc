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

# implementing no longer cites a file manifest test_design doesn't write
if grep -qi 'manifest\.json' orc/factory/prompts/implementing.md; then fail "implementing.md still references manifest.json"; else ok; fi

# a pack with Bash patterns gets a generated Shell section: its exact commands, one per call
sh_out="$(run render implementing "$fx/stage-input.example.json")"
for needle in "## Shell" "\`git commit\`" "\`orc-state\`" "one command per call" "never a reason to escalate"; do
  if printf '%s' "$sh_out" | grep -qF -- "$needle"; then ok; else fail "render implementing: Shell section missing '$needle'"; fi
done
if run render evidence "$fx/stage-input.example.json" | grep -qF "## Shell"; then fail "render evidence: no Bash, no Shell section"; else ok; fi

# approved test cases (stage input schema 2) render for implementing and verifying
cases="$tmp/cases.json"
jq '.schema = 3 | .context.testCases = [
  {"title":"rejects a bad password","criterion":"Bad password shows an error","approach":"run src/login.test.ts, confirm it rejects"},
  {"title":"keeps the session","criterion":null,"approach":"manual: open devtools, confirm the cookie survives a reload"}]' "$fx/stage-input.example.json" > "$cases"
if run validate --input "$cases" >/dev/null 2>&1; then ok; else fail "validate: stage input schema 3 with testCases"; fi
jq '.schema = 4' "$fx/stage-input.example.json" > "$tmp/in4.json"
run validate --input "$tmp/in4.json" >/dev/null 2>&1 && rc=0 || rc=$?
if [ "$rc" = 1 ]; then ok; else fail "validate: stage input schema 4 must fail (rc=$rc)"; fi
for pk in implementing verifying; do
  rc_out="$(run render "$pk" "$cases")"
  if printf '%s' "$rc_out" | grep -qF -- "- rejects a bad password (proves: Bad password shows an error): run src/login.test.ts, confirm it rejects" \
    && printf '%s' "$rc_out" | grep -qF -- "- keeps the session: manual: open devtools, confirm the cookie survives a reload"; then ok; else fail "render $pk: test cases missing"; fi
  if run render "$pk" "$fx/stage-input.example.json" | grep -qF "{{context.testCases}}"; then fail "render $pk: unreplaced testCases"; else ok; fi
done

# verifying is writable now: review tools union implementing's write/test/commit set
vft="$(jq -c '.packs.verifying.tools' "$packs")"
for t in '"Bash(git diff:*)"' '"Bash(gh pr diff:*)"' '"Write"' '"Edit"' '"Bash(git add:*)"' '"Bash(git commit:*)"' '"Bash(pnpm:*)"'; do
  if printf '%s' "$vft" | jq -e --argjson t "$t" 'index($t) != null' >/dev/null; then ok; else fail "verifying tools missing $t: $vft"; fi
done
if jq -e '.packs.verifying.writable == true and .packs.verifying.maxTurns == 60 and .packs.verifying.timeoutMs == 1200000' "$packs" >/dev/null; then ok; else fail "verifying must be writable, 60 turns, 1200000ms"; fi
if jq -e '.packs.verifying.outputSchema.properties.results.items.required == ["title","criterion","approach","outcome"]' "$packs" >/dev/null; then ok; else fail "verifying must answer results[] {title, criterion, approach, outcome}"; fi
if jq -e '.packs.verifying.outputSchema.required | index("results") == null' "$packs" >/dev/null; then ok; else fail "verifying's results must not be required (a questions answer has none)"; fi

# custom template via ORC_FACTORY_STAGES
printf 'CUSTOM {{task.title}} / {{attempt}} / {{agent}}\n' > "$tmp/t.md"
jq --arg t "$tmp/t.md" '.packs.implementing.promptTemplate=$t' "$packs" > "$tmp/stages.json"
c="$(ORC_FACTORY_STAGES="$tmp/stages.json" run render implementing "$rich")"
if printf '%s' "$c" | grep -qF "CUSTOM Add CSV export / 1 / orc-implementer"; then ok; else fail "render: custom template not used"; fi

# shipped templates: each of the eight packs renders its own file, under 6 KB
for pair in triage:orc-prd-analyzer:"TRIAGE STAGE" test_design:orc-prd-analyzer:"TEST DESIGN STAGE" \
  implementing:orc-implementer:"IMPLEMENTING STAGE" verifying:orc-verifier:"VERIFYING STAGE" \
  e2e:orc-qa-validator:"E2E STAGE" evidence:script:"EVIDENCE STAGE" \
  ci_watch:orc-ci-investigator:"CI WATCH STAGE" reviewing_memory:orc-refactor-architect:"REVIEWING MEMORY STAGE"; do
  pk="${pair%%:*}"; rest="${pair#*:}"; ag="${rest%%:*}"; head="${rest#*:}"
  rp="$(run render "$pk" "$fx/stage-input.example.json")" && rc=0 || rc=$?
  if [ "$rc" = 0 ]; then ok; else fail "render $pk: rc=$rc"; continue; fi
  sz="$(printf '%s' "$rp" | wc -c | tr -d ' ')"
  if [ "$sz" -lt 6144 ]; then ok; else fail "render $pk: $sz bytes (>= 6144)"; fi
  if printf '%s' "$rp" | grep -qF -- "$ag"; then ok; else fail "render $pk: missing agent $ag"; fi
  if printf '%s' "$rp" | grep -qF -- "$head"; then ok; else fail "render $pk: shipped template not used (no '$head')"; fi
  if printf '%s' "$rp" | grep -qF "{{"; then fail "render $pk: unreplaced placeholder"; else ok; fi
  if printf '%s' "$rp" | grep -qF "AskUserQuestion"; then ok; else fail "render $pk: no AskUserQuestion reminder"; fi
done
# output schemas carry the shapes the prompts promise
if jq -e '.packs.triage.outputSchema.properties | has("slices") and has("kind")' "$packs" >/dev/null; then ok; else fail "schema: triage needs kind + slices"; fi
# only a rejected usage window is a limit; the SDK's allowed_warning must not pause a run that finishes
if grep -q "info.status === 'rejected'" orc/lib/factory/run.mjs && ! grep -q "info.status !== 'allowed'" orc/lib/factory/run.mjs; then ok; else fail "run.mjs must treat only a rejected rate_limit_event as a limit"; fi
# the timer approval reads both: a plan is approved by itself only when confidence is high and risk is low
if jq -e '.packs.triage.outputSchema.properties | (.confidence.enum == ["low","medium","high"]) and (.risk.enum == ["low","medium","high"])' "$packs" >/dev/null; then ok; else fail "schema: triage needs confidence + risk enums low/medium/high"; fi
if grep -q 'confidence.: .high. only when' orc/factory/prompts/triage.md && grep -q 'risk.: what the touchpoints are' orc/factory/prompts/triage.md; then ok; else fail "triage prompt must say how to grade confidence and risk"; fi
if jq -e '.packs.implementing.outputSchema.properties.kind.enum == ["done","test_change","escalated"]' "$packs" >/dev/null; then ok; else fail "schema: implementing kind enum"; fi
if jq -e '.packs.test_design.outputSchema.properties.kind.enum == ["done","questions"]' "$packs" >/dev/null; then ok; else fail "schema: test_design kind enum"; fi

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
  and .allowedTools == $t and .permissionMode == "dontAsk"
  and .env.ORC_FACTORY == "1" and .outputFormat.type == "json_schema"' >/dev/null; then ok; else fail "run --dry-run: options JSON wrong: $dry"; fi
# `tools` takes bare built-in names; the patterns only go in `allowedTools`. A pattern in
# `tools` names no tool, so the pack silently loses Bash.
if printf '%s' "$opts" | jq -e '(.tools | index("Bash")) != null and (.tools | index("Read")) != null
  and all(.tools[]; (contains("(") | not) and (startswith("mcp__") | not))
  and (.tools | length) == (.tools | unique | length)' >/dev/null; then ok; else fail "run --dry-run: tools must be bare names incl. Bash: $(printf '%s' "$opts" | jq -c .tools)"; fi
if run validate --output "$o1/result.json" >/dev/null 2>&1; then ok; else fail "run --dry-run: result.json invalid"; fi
if [ -f "$o1/prompt.md" ] && [ "$(wc -l < "$o1/events.jsonl" | tr -d ' ')" -ge 1 ]; then ok; else fail "run --dry-run: prompt.md/events.jsonl missing"; fi
if jq -e '.ok == true and .outcome == "pass" and .summary == "dry-run"' "$o1/result.json" >/dev/null; then ok; else fail "run --dry-run: result not pass/dry-run"; fi
if tail -n1 "$o1/events.jsonl" | jq -e '.kind == "note" and .payload.phase == "stage_end" and .payload.outcome == "pass"' >/dev/null; then ok; else fail "run: last event not stage_end"; fi

# test_design is read-only now: same tools as triage, no writable, scenarios carry "approach"
tdt="$(jq -c '.packs.test_design.tools' "$packs")"
trt="$(jq -c '.packs.triage.tools' "$packs")"
if [ "$tdt" = "$trt" ]; then ok; else fail "test_design tools must match triage's: $tdt != $trt"; fi
if jq -e '.packs.test_design.writable == false' "$packs" >/dev/null; then ok; else fail "test_design must be writable: false"; fi
if jq -e '.packs.test_design.outputSchema.properties.cases.items.required == ["title","criterion","approach"]' "$packs" >/dev/null; then ok; else fail "test_design cases[] must require title/criterion/approach"; fi
if grep -qE '^## What to do' orc/factory/prompts/test_design.md && ! grep -qiE 'manifest\.json|run the new tests|do not touch production code' orc/factory/prompts/test_design.md; then ok; else fail "test_design.md still references file-writing/running steps"; fi

# escalated answer -> outcome escalated (stage-output schema 2); schema 1 has no escalated
o5="$tmp/out5"
(cd "$tmp" && ORC_STAGE_DRY_STRUCTURED='{"kind":"escalated","summary":"stopped","reason":"needs a new dependency","options":["add it"]}' \
  run run --dry-run --in "$fx/stage-input.example.json" --out "$o5" >/dev/null 2>&1) && rc=0 || rc=$?
if [ "$rc" = 0 ] && jq -e '.schema == 2 and .outcome == "escalated" and .answer.reason == "needs a new dependency"' "$o5/result.json" >/dev/null; then ok; else fail "run escalated: want schema 2 / outcome escalated: $(jq -c '{schema,outcome}' "$o5/result.json" 2>/dev/null)"; fi
if run validate --output "$o5/result.json" >/dev/null 2>&1; then ok; else fail "run escalated: result.json invalid"; fi
if tail -n1 "$o5/events.jsonl" | jq -e '.payload.outcome == "escalated"' >/dev/null; then ok; else fail "run escalated: stage_end outcome"; fi
jq '.schema = 1 | .outcome = "escalated"' "$o5/result.json" > "$tmp/esc1.json"
run validate --output "$tmp/esc1.json" >/dev/null 2>&1 && rc=0 || rc=$?
if [ "$rc" = 1 ]; then ok; else fail "validate: schema 1 must reject outcome escalated (rc=$rc)"; fi

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

# --- agent-less pack + rulesMarkdown (run.mjs, no SDK) -------------------------
pj="$(jq -c '.packs.evidence' "$packs")"
ev() { # <outdir> -> runs run.mjs for the evidence pack in a scratch cwd
  mkdir -p "$1"
  (cd "$tmp" && ORC_STAGE_IN="$fx/stage-input.example.json" ORC_STAGE_OUT="$1" ORC_STAGE_PROMPT="$tmp/t.md" \
    ORC_STAGE_PACK_JSON="$pj" ORC_PLUGIN_ROOT="$plugin_root" node "$repo_root/orc/lib/factory/run.mjs" >/dev/null 2>&1)
}
e1="$tmp/ev1"; mkdir -p "$e1/files/qa"; printf '{"verdict":"pass"}' > "$e1/files/qa/qa-manifest.json"
if ev "$e1" && jq -e '.ok == true and .outcome == "pass" and (.artifacts|map(.kind)|index("qa-manifest")) != null' "$e1/result.json" >/dev/null; then ok; else fail "evidence: manifest pass -> outcome pass"; fi
e2="$tmp/ev2"; mkdir -p "$e2/files/qa"; printf '{"verdict":"skipped"}' > "$e2/files/qa/qa-manifest.json"
if ev "$e2" && jq -e '.outcome == "pass"' "$e2/result.json" >/dev/null; then ok; else fail "evidence: skipped -> pass"; fi
e3="$tmp/ev3"; mkdir -p "$e3/files/qa"; printf '{"verdict":"partial"}' > "$e3/files/qa/qa-manifest.json"
if ev "$e3" && jq -e '.outcome == "fail"' "$e3/result.json" >/dev/null; then ok; else fail "evidence: partial -> fail"; fi
e4="$tmp/ev4"
if ev "$e4" && jq -e '.outcome == "fail" and .ok == false' "$e4/result.json" >/dev/null; then ok; else fail "evidence: no manifest -> fail"; fi
if run validate --output "$e1/result.json" >/dev/null 2>&1; then ok; else fail "evidence: result.json invalid"; fi
r1="$tmp/rm1"; mkdir -p "$r1"
(cd "$tmp" && ORC_STAGE_DRY_STRUCTURED='{"summary":"s","rulesMarkdown":"# rules\n"}' ORC_STAGE_DRY_RUN=1 ORC_STAGE_IN="$fx/stage-input.example.json" \
  ORC_STAGE_OUT="$r1" ORC_STAGE_PROMPT="$tmp/t.md" ORC_STAGE_PACK_JSON="$(jq -c '.packs.reviewing_memory' "$packs")" \
  ORC_PLUGIN_ROOT="$plugin_root" node "$repo_root/orc/lib/factory/run.mjs" >/dev/null 2>&1) || true
if [ -f "$r1/files/rules.md" ] && jq -e '.artifacts|any(.path=="files/rules.md" and .kind=="rules")' "$r1/result.json" >/dev/null; then ok; else fail "rulesMarkdown: files/rules.md rules artifact missing"; fi
if jq -e '.answer.summary == "s" and .answer.rulesMarkdown != null' "$r1/result.json" >/dev/null; then ok; else fail "answer: structured output not carried in result.json"; fi
if jq -e '.answer == null' "$o1/result.json" >/dev/null; then ok; else fail "answer: dry-run without structured output must be null"; fi
# verifying uses read-only git, reviewer agent matches
for t in 'Bash(git diff:*)' 'Bash(git log:*)' 'Bash(git merge-base:*)'; do
  if jq -e --arg t "$t" '.packs.verifying.tools|index($t)' "$packs" >/dev/null && grep -qF "$t" "$repo_root/orc/agents/orc-pr-reviewer.md"; then ok; else fail "verifying/reviewer missing tool $t"; fi
done
# verifying gets the base commit from the controller; a `$(git merge-base ...)` one-liner is a denied call
vb="$tmp/base.json"; jq '.context.baseCommit = "abc1234def"' "$fx/stage-input.example.json" > "$vb"
if run render verifying "$vb" | grep -qF 'git diff abc1234def..HEAD'; then ok; else fail "verifying prompt: baseCommit not rendered into the diff command"; fi
vr="$(run render verifying "$fx/stage-input.example.json")"
sub="\$("  # a command substitution in the prompt text
if printf '%s' "$vr" | grep -qF -- "$sub"; then fail "verifying prompt: still carries a command-substitution one-liner"; else ok; fi
if printf '%s' "$vr" | grep -qF '(unknown)' && ! printf '%s' "$vr" | grep -qF '{{'; then ok; else fail "verifying prompt: null baseCommit must render (unknown)"; fi

# --- read-only sandbox: state dir, HOME, preinstall guard ----------------------
ro="$tmp/ro-cwd"; mkdir -p "$ro" "$tmp/tmpd"
chmod 555 "$ro"
ro_err="$tmp/ro.err"
ro_out="$(cd "$ro" && env -u ORC_STATE_DIR TMPDIR="$tmp/tmpd" bash "$stage" run --dry-run --in "$fx/stage-input.example.json" --out "$tmp/ro-out" 2>"$ro_err")" && rc=0 || rc=$?
chmod 755 "$ro"
if [ "$rc" = 0 ]; then ok; else fail "read-only cwd: rc=$rc ($(cat "$ro_err"))"; fi
if grep -qF 'cwd is read-only' "$ro_err"; then ok; else fail "read-only cwd: stderr lacks notice"; fi
if printf '%s' "$ro_out" | jq -e --arg d "$tmp/tmpd" '.env.ORC_STATE_DIR | startswith($d)' >/dev/null 2>&1; then ok; else fail "read-only cwd: env.ORC_STATE_DIR not under TMPDIR: $ro_out"; fi
if run validate --output "$tmp/ro-out/result.json" >/dev/null 2>&1; then ok; else fail "read-only cwd: result.json invalid"; fi
hm_out="$(cd "$tmp" && HOME=/nonexistent bash "$stage" run --dry-run --in "$fx/stage-input.example.json" --out "$tmp/hm-out" 2>/dev/null)" && rc=0 || rc=$?
if [ "$rc" = 0 ]; then ok; else fail "HOME=/nonexistent: rc=$rc"; fi
hm="$(printf '%s' "$hm_out" | jq -r '.env.HOME' 2>/dev/null || true)"
if [ -n "$hm" ] && [ -d "$hm" ] && [ -w "$hm" ]; then ok; else fail "HOME=/nonexistent: env.HOME not writable: $hm"; fi
ropl="$tmp/ro-plugin"; mkdir -p "$ropl"; cp -R "$repo_root/orc/." "$ropl/"; rm -rf "$ropl/lib/factory/node_modules"
chmod -R a-w "$ropl"
pre_err="$(cd "$tmp" && bash "$ropl/bin/orc-stage" run --in "$fx/stage-input.example.json" --out "$tmp/pre-out" 2>&1 >/dev/null)" && rc=0 || rc=$?
chmod -R u+w "$ropl"
if [ "$rc" = 4 ]; then ok; else fail "SDK absent + lib read-only: rc=$rc, want 4"; fi
if printf '%s' "$pre_err" | grep -qi 'preinstall'; then ok; else fail "SDK absent + lib read-only: message lacks preinstall: $pre_err"; fi
if run render implementing "$fx/stage-input.example.json" | grep -qF 'Locked tests' && run render implementing "$fx/stage-input.example.json" | grep -qF 'test_change'; then ok; else fail "implementing prompt: Locked tests paragraph missing"; fi

# --- the pack's agent is the system prompt; its model/effort apply; its skills are inlined ------
ag_body="$(awk 'f&&NF{print;exit} /^---$/{c++; if(c==2)f=1}' "$repo_root/orc/agents/orc-implementer.md")"
if printf '%s' "$opts" | jq -e --arg b "$ag_body" '.systemPrompt.type == "preset" and .systemPrompt.preset == "claude_code" and (.systemPrompt.append | contains($b))' >/dev/null; then ok; else fail "run --dry-run: systemPrompt must be the claude_code preset + the agent body: $(printf '%s' "$opts" | jq -c '.systemPrompt | if type=="object" then .append |= .[0:80] else . end')"; fi
if printf '%s' "$opts" | jq -e '.systemPrompt.append | (contains("model: sonnet") | not) and (startswith("---") | not)' >/dev/null; then ok; else fail "run --dry-run: agent frontmatter leaked into systemPrompt"; fi
for sk in orc:tdd orc:verification-before-completion orc:code-discovery; do
  first="$(awk 'f&&NF{print;exit} /^---$/{c++; if(c==2)f=1}' "$repo_root/orc/skills/${sk#orc:}/SKILL.md")"
  if printf '%s' "$opts" | jq -e --arg h "## Skill: $sk" --arg f "$first" '.systemPrompt.append | contains($h) and contains($f)' >/dev/null; then ok; else fail "run --dry-run: skill $sk not inlined under '## Skill: $sk'"; fi
done
if printf '%s' "$opts" | jq -e '.model == "sonnet" and .effort == "medium"' >/dev/null; then ok; else fail "run --dry-run: model/effort must come from the agent frontmatter: $(printf '%s' "$opts" | jq -c '{model,effort}')"; fi
pm="$tmp/pm.json"; jq '.packs.implementing.model = "opus"' "$packs" > "$pm"
pm_out="$(cd "$tmp" && ORC_FACTORY_STAGES="$pm" run run --dry-run --in "$fx/stage-input.example.json" --out "$tmp/pm-out" 2>/dev/null | jq -r .model)"
if [ "$pm_out" = "opus" ]; then ok; else fail "run --dry-run: pack.model must win over the agent's: $pm_out"; fi
mkdir -p "$tmp/ev-dry"
ev_out="$(cd "$tmp" && ORC_STAGE_PACK_JSON="$(jq -c '.packs.evidence' "$packs")" ORC_STAGE_DRY_RUN=1 ORC_STAGE_IN="$fx/stage-input.example.json" ORC_STAGE_OUT="$tmp/ev-dry" ORC_STAGE_PROMPT="$tmp/t.md" ORC_PLUGIN_ROOT="$plugin_root" node "$repo_root/orc/lib/factory/run.mjs" 2>/dev/null | jq -c '[.systemPrompt, .model, .effort]')"
if [ "$ev_out" = "[null,null,null]" ]; then ok; else fail "run --dry-run: a script pack has no agent, so no systemPrompt/model/effort: $ev_out"; fi

# --- ci_watch escalates infra/needs_debug like every other pack; the controller feeds it the CI facts ----
if jq -e '.packs.ci_watch.outputSchema.properties | (.kind.enum == ["done","escalated"]) and (.reason.type == "string") and (.options.type == "array")' "$packs" >/dev/null; then ok; else fail "schema: ci_watch needs kind/reason/options"; fi
if jq -e '.packs.ci_watch.outputSchema.required | index("kind") == null' "$packs" >/dev/null; then ok; else fail "schema: ci_watch kind must stay optional (a green answer has none)"; fi
if grep -qF 'kind: "escalated"' orc/factory/prompts/ci_watch.md && grep -qF '{{context.ci}}' orc/factory/prompts/ci_watch.md; then ok; else fail "ci_watch.md: must escalate via kind and render {{context.ci}}"; fi
ci="$tmp/ci.json"
jq '.context.ci = {"pr":{"number":42,"url":"https://x/pull/42"},"checks":[{"name":"machine","state":"failure","url":"https://x/runs/9"},{"name":"site","state":"success","url":null}],"logs":"FAIL src/a.test.ts > boom\n  expected 1 to be 2"}' "$fx/stage-input.example.json" > "$ci"
ci_out="$(run render ci_watch "$ci")"
for needle in "PR #42 https://x/pull/42" "- machine: failure https://x/runs/9" "- site: success" "FAIL src/a.test.ts > boom"; do
  if printf '%s' "$ci_out" | grep -qF -- "$needle"; then ok; else fail "render ci_watch: missing '$needle'"; fi
done
if run render ci_watch "$fx/stage-input.example.json" | grep -qF '{{'; then fail "render ci_watch: unreplaced placeholder with context.ci absent"; else ok; fi

# --- implementing sees the plan's slices (it seeds the ledger from them) ------
sl="$tmp/slices.json"
jq '.plan = {"brief":"b","criteria":["c1"],"assumptions":[],"slices":[{"title":"Exporter","est_loc":80,"touchpoints":["src/export.ts"],"acceptance":["writes UTF-8"]},{"title":"Button","est_loc":20,"touchpoints":[],"acceptance":[]}]}' "$fx/stage-input.example.json" > "$sl"
sl_out="$(run render implementing "$sl")"
for needle in "1. Exporter (~80 LOC) touches src/export.ts; accepts: writes UTF-8" "2. Button (~20 LOC)"; do
  if printf '%s' "$sl_out" | grep -qF -- "$needle"; then ok; else fail "render implementing: slices missing '$needle'"; fi
done
if run render implementing "$fx/stage-input.noplan.json" | grep -qF '{{plan.slices}}'; then fail "render implementing: unreplaced plan.slices with a null plan"; else ok; fi

# --- the input as luna's machine writes it (schema 3) validates and renders; tests[] is gone ---
if run validate --input "$fx/stage-input.luna.json" >/dev/null 2>&1; then ok; else fail "validate --input rejects the luna-shaped fixture"; fi
if jq -e '.schema == 3 and (.context | has("tests") | not) and (.context.testCases | length) > 0 and (.context | has("baseCommit")) and (.plan.slices | length) > 0' "$fx/stage-input.luna.json" >/dev/null; then ok; else fail "stage-input.luna.json must be schema 3 with testCases, baseCommit and plan.slices, without tests[]"; fi
for pk in implementing verifying ci_watch; do
  if run render "$pk" "$fx/stage-input.luna.json" | grep -qF '{{'; then fail "render $pk (luna fixture): unreplaced placeholder"; else ok; fi
done
if jq -e '.properties.context.required | index("tests") == null' "$repo_root/orc/factory/schema/stage-input.json" >/dev/null; then ok; else fail "stage-input schema: context.tests must not be required"; fi
if jq -e '.context | has("tests") | not' "$fx/stage-input.example.json" >/dev/null; then ok; else fail "stage-input.example.json still carries tests[]"; fi

# --- a state dir set from outside (the sandbox's /tmp/orc-state) survives context detection ---
# The SessionStart hook evals orc_detect_context and exports the result into every Bash call;
# inside a stage container that used to clobber ORC_STATE_DIR with <worktree>/.orc, so the
# slice ledger landed in the worktree as an untracked file and the implementer failed the
# "left uncommitted changes" check six times in a row.
sd_repo="$tmp/sd-repo"; mkdir -p "$sd_repo"; git -C "$sd_repo" init -q
sd_out="$(cd "$sd_repo" && env -u ORC_CONTEXT_CACHED ORC_STATE_DIR=/tmp/elsewhere bash -c ". '$repo_root/orc/lib/workspace-detect.sh'; orc_detect_context" | grep '^ORC_STATE_DIR=')"
if [ "$sd_out" = "ORC_STATE_DIR=/tmp/elsewhere" ]; then ok; else fail "detect: a preset ORC_STATE_DIR must win in a repo, got '$sd_out'"; fi
# ...but one that an earlier detection exported (ORC_CONTEXT_CACHED=1) is re-derived when cwd moved.
sd_out="$(cd "$sd_repo" && ORC_CONTEXT_CACHED=1 ORC_CONTEXT_CACHED_PWD=/somewhere/else ORC_STATE_DIR=/tmp/stale bash -c ". '$repo_root/orc/lib/workspace-detect.sh'; orc_detect_context" | grep '^ORC_STATE_DIR=')"
if [ "$sd_out" = "ORC_STATE_DIR=$(cd "$sd_repo" && pwd -P)/.orc" ]; then ok; else fail "detect: a stale cached ORC_STATE_DIR must be re-derived, got '$sd_out'"; fi

# --- the stage input's limits win over the pack's defaults: the controller scales implementing's turns by slice count ---
jq '.limits.maxTurns = 160' "$fx/stage-input.luna.json" > "$tmp/scaled-input.json"
mkdir -p "$tmp/scaled-dry"
scaled="$(cd "$tmp" && ORC_STAGE_PACK_JSON="$(jq -c '.packs.implementing' "$packs")" ORC_STAGE_DRY_RUN=1 ORC_STAGE_IN="$tmp/scaled-input.json" ORC_STAGE_OUT="$tmp/scaled-dry" ORC_STAGE_PROMPT="$tmp/t.md" ORC_PLUGIN_ROOT="$plugin_root" node "$repo_root/orc/lib/factory/run.mjs" 2>/dev/null | jq -c '.maxTurns')"
if [ "$scaled" = "160" ]; then ok; else fail "run --dry-run: limits.maxTurns from the input must set maxTurns, got '$scaled'"; fi

# --- e2e escalates like every other pack: kind/reason/options on its output schema, and the prompt says when ---
if jq -e '.packs.e2e.outputSchema.properties | (.kind.enum == ["done","escalated"]) and (.reason.type == "string") and (.options.type == "array")' "$packs" >/dev/null; then ok; else fail "schema: e2e needs kind/reason/options"; fi
if grep -q 'kind: "escalated"' "$repo_root/orc/factory/prompts/e2e.md"; then ok; else fail "e2e prompt: no escalation rule"; fi

# --- e2e judges only what a browser can observe, and is not asked to stop a server it has no tool to stop ---
if grep -q "not browser-observable" "$repo_root/orc/factory/prompts/e2e.md" && ! grep -q "Stop the dev server before you answer" "$repo_root/orc/factory/prompts/e2e.md"; then ok; else fail "e2e prompt: browser-observable rule / dev-server line"; fi

[ "$status" = 0 ] || exit 1
echo "verify-stage: OK ($pass_count checks)"
