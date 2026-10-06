#!/usr/bin/env bash
# shellcheck disable=SC2015
# Fixture tests for bin/orc-explain — segments.json validation, cache setup
# (npm skipped), and the ffmpeg timeline assembly with fallback title cards.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cli="$repo_root/orc/bin/orc-explain"
status=0; pass_count=0
fail() { echo "verify-explain: FAIL — $1"; status=1; }
ok() { pass_count=$((pass_count + 1)); }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
export XDG_CACHE_HOME="$tmp/cache" ORC_EXPLAIN_SKIP_NPM=1

cat > "$tmp/good.json" <<'EOF'
{ "schema": 1, "branch": "feat-x", "style": "isometric", "voice": "af_heart", "segments": [
  { "id": "s01", "kind": "graphic", "title": "Hello", "lines": ["a", "b"], "narration": "Intro." },
  { "id": "s02", "kind": "clip", "source": "demo/clip.webm", "caption": "AC 1.1 — works", "narration": "Clip." } ] }
EOF
bash "$cli" validate --segments "$tmp/good.json" >/dev/null && ok || fail "validate good"
jq '.segments[1] |= del(.source)' "$tmp/good.json" > "$tmp/bad1.json"
set +e; err="$(bash "$cli" validate --segments "$tmp/bad1.json" 2>&1)"; rc=$?; set -e
[ "$rc" -eq 2 ] && printf '%s' "$err" | grep -q 's02' && ok || fail "clip without source must exit 2 naming s02"
jq '.segments[0] |= del(.narration)' "$tmp/good.json" > "$tmp/bad2.json"
set +e; err="$(bash "$cli" validate --segments "$tmp/bad2.json" 2>&1)"; rc=$?; set -e
[ "$rc" -eq 2 ] && printf '%s' "$err" | grep -q 's01' && ok || fail "missing narration must exit 2 naming s01"

jq '.segments[0].id = "../x"' "$tmp/good.json" > "$tmp/bad3.json"
set +e; err="$(bash "$cli" validate --segments "$tmp/bad3.json" 2>&1)"; rc=$?; set -e
[ "$rc" -eq 2 ] && printf '%s' "$err" | grep -q 'must be a slug' && ok || fail "non-slug id must exit 2 (path traversal guard)"
set +e; err="$(ORC_ANIMATE_ROOT=/nonexistent ORC_ANIMATE_RENDER=1 bash "$cli" graphics --segments "$tmp/good.json" --work "$tmp/nopieces" 2>&1)"; rc=$?; set -e
[ "$rc" -eq 0 ] && ok || fail "render flag without animate must still be a no-op (rc=$rc)"
bash "$cli" setup >/dev/null
[ -f "$XDG_CACHE_HOME/orc/explain/narrate.mjs" ] && [ -f "$XDG_CACHE_HOME/orc/explain/package.json" ] && ok || fail "setup must stage narrate.mjs + package.json"
[ -f "$XDG_CACHE_HOME/orc/explain/animate-piece.mjs" ] && [ -f "$XDG_CACHE_HOME/orc/explain/animate.lock" ] && ok || fail "setup must stage animate-piece.mjs + animate.lock"
ORC_ANIMATE_ROOT=/nonexistent bash "$cli" graphics --segments "$tmp/good.json" --work "$tmp/work" | grep -q 'fallback cards' && ok || fail "graphics without animate must exit 0 printing fallback cards"

if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  mkdir -p "$tmp/qa/demo" "$tmp/work/narration"
  ffmpeg -v error -y -f lavfi -i color=c=green:s=320x180:d=1 -c:v libvpx "$tmp/qa/demo/clip.webm"
  ffmpeg -v error -y -f lavfi -i anullsrc=r=24000:cl=mono -t 3 "$tmp/work/narration/s01.wav"
  ffmpeg -v error -y -f lavfi -i anullsrc=r=24000:cl=mono -t 2 "$tmp/work/narration/s02.wav"
  bash "$cli" assemble --segments "$tmp/good.json" --work "$tmp/work" --qa-dir "$tmp/qa" --out "$tmp/qa/explainer-feat-x.mp4" >/dev/null
  [ -s "$tmp/qa/explainer-feat-x.mp4" ] && ok || fail "assemble output"
  d="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp/qa/explainer-feat-x.mp4" | cut -d. -f1)"
  [ "$d" -ge 4 ] && [ "$d" -le 6 ] && ok || fail "duration must be ≈ 3s (card padded to narration) + 2s (clip padded to narration) (got ${d}s)"
  ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$tmp/qa/explainer-feat-x.mp4" | grep -q audio && ok || fail "output must carry an audio track"
else
  echo "verify-explain: note — ffmpeg absent, assemble cases skipped"
  set +e; bash "$cli" assemble --segments "$tmp/good.json" --work "$tmp/work" --qa-dir "$tmp" --out "$tmp/o.mp4" >/dev/null 2>&1; rc=$?; set -e
  [ "$rc" -eq 4 ] && ok || fail "assemble without ffmpeg must exit 4"
fi
[ "$status" -eq 0 ] && echo "verify-explain: OK ($pass_count cases)"
exit "$status"
