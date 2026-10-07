#!/usr/bin/env bash
# Fixture tests for bin/orc-qa-video — Playwright results.json → ordered scenario
# plan, console/trace collection, and (ffmpeg present) the stitched QA video +
# chapters.json. Run from the repo root.
# shellcheck disable=SC2015  # `A && ok || fail` is the fixture idiom; ok never fails
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cli="$repo_root/orc/bin/orc-qa-video"
status=0; pass_count=0
fail() { echo "verify-qa-video: FAIL — $1"; status=1; }
ok() { pass_count=$((pass_count + 1)); }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/tr/a" "$tmp/tr/b" "$tmp/qa"
printf 'log a' > "$tmp/tr/a/console.log"; printf 'zip' > "$tmp/tr/a/trace.zip"
printf 'log b' > "$tmp/tr/b/console.log"
cat > "$tmp/results.json" <<EOF
{ "suites": [
  { "title": "auth.setup.ts", "specs": [ { "title": "authenticate", "file": "auth.setup.ts",
      "tests": [ { "projectName": "setup", "results": [ { "status": "passed", "duration": 10, "attachments": [] } ] } ] } ] },
  { "title": "export", "suites": [ { "title": "CSV export", "specs": [
      { "title": "Export golden path @golden", "file": "export/golden.spec.ts",
        "tests": [ { "projectName": "qa", "results": [ { "status": "passed", "duration": 1200, "attachments": [
          { "name": "video", "path": "$tmp/tr/a/video.webm", "contentType": "video/webm" },
          { "name": "console.log", "path": "$tmp/tr/a/console.log", "contentType": "text/plain" },
          { "name": "trace", "path": "$tmp/tr/a/trace.zip", "contentType": "application/zip" } ] } ] } ] },
      { "title": "Export empty state", "file": "export/empty.spec.ts",
        "tests": [ { "projectName": "qa", "results": [ { "status": "failed", "duration": 800, "attachments": [
          { "name": "video", "path": "$tmp/tr/b/video.webm", "contentType": "video/webm" },
          { "name": "console.log", "path": "$tmp/tr/b/console.log", "contentType": "text/plain" } ] } ] } ] },
      { "title": "Export empty state", "file": "export/empty-mobile.spec.ts",
        "tests": [ { "projectName": "qa", "results": [ { "status": "passed", "duration": 10, "attachments": [] } ] } ] } ] } ] } ] }
EOF

plan="$(bash "$cli" plan --results "$tmp/results.json")"
[ "$(printf '%s' "$plan" | jq 'length')" = "3" ] && ok || fail "plan must skip the setup project (got $(printf '%s' "$plan" | jq -c .))"
[ "$(printf '%s' "$plan" | jq -r '.[2].id')" = "export-empty-state-2" ] && ok || fail "duplicate titles must get distinct ids"
[ "$(printf '%s' "$plan" | jq -r '.[0].id')" = "export-golden-path-golden" ] && ok || fail "plan id slug"
[ "$(printf '%s' "$plan" | jq -r '.[1].outcome')" = "failed" ] && ok || fail "plan outcome"
[ "$(printf '%s' "$plan" | jq -r '.[0].video')" = "$tmp/tr/a/video.webm" ] && ok || fail "plan video path"

bash "$cli" collect --results "$tmp/results.json" --qa-dir "$tmp/qa" >/dev/null
[ "$(cat "$tmp/qa/console-export-golden-path-golden.log")" = "log a" ] && ok || fail "collect console"
[ -f "$tmp/qa/trace-export-golden-path-golden.zip" ] && ok || fail "collect trace"
[ -f "$tmp/qa/console-export-empty-state.log" ] && ok || fail "collect second console"

if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  ffmpeg -v error -y -f lavfi -i color=c=blue:s=320x180:d=1 -c:v libvpx "$tmp/tr/a/video.webm"
  ffmpeg -v error -y -f lavfi -i color=c=red:s=320x180:d=1 -c:v libvpx "$tmp/tr/b/video.webm"
  bash "$cli" stitch --results "$tmp/results.json" --qa-dir "$tmp/qa" --branch feat-x --card-seconds 1 >/dev/null
  [ -s "$tmp/qa/qa-feat-x.webm" ] && ok || fail "stitch output"
  [ "$(jq 'length' "$tmp/qa/chapters.json")" = "2" ] && ok || fail "chapters count"
  jq -e '.[1].start > .[0].start and .[0].title == "Export golden path @golden"' "$tmp/qa/chapters.json" >/dev/null && ok || fail "chapters ordered with titles"
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp/qa/qa-feat-x.webm" | cut -d. -f1)"
  [ "$dur" -ge 3 ] && ok || fail "stitched duration must cover cards + clips (got ${dur}s)"
else
  echo "verify-qa-video: note — ffmpeg absent, stitch cases skipped"
  set +e; bash "$cli" stitch --results "$tmp/results.json" --qa-dir "$tmp/qa" --branch feat-x >/dev/null 2>&1; rc=$?; set -e
  [ "$rc" -eq 4 ] && ok || fail "stitch without ffmpeg must exit 4"
fi

[ "$status" -eq 0 ] && echo "verify-qa-video: OK ($pass_count cases)"
exit "$status"
