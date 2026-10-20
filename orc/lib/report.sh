#!/usr/bin/env bash
# QA report renderer behind bin/orc-report. Reads the browser-QA packet
# (files/qa/qa-manifest.json, schema in orc:state-protocol) plus the optional
# mechanical qa-verdict.json, and emits one normalized report JSON — or that
# JSON injected into lib/report-template.html, written beside the evidence so
# relative image paths resolve (locally and when published as an Artifact).
# Sourced after lib/state.sh (session + state-dir resolution).

orc_report__qa_dir() { # $1 = sid
  printf '%s/%s/files/qa\n' "$(orc_state__dir)" "$1"
}

orc_report_json() { # [--branch B]
  local branch="" sid qa files entry verdict head missing f
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) branch="${2:-}"; shift 2 ;;
      *) echo "orc-report: unknown argument $1" >&2; return 2 ;;
    esac
  done
  sid="$(orc_state__sid "$branch")" || return 1
  qa="$(orc_report__qa_dir "$sid")"
  [ -f "$qa/qa-manifest.json" ] || { echo "orc-report: no QA packet at $qa (run /orc:qa first)" >&2; return 1; }
  files="$(dirname "$qa")"
  entry="$(orc_state__entry "$sid" 2>/dev/null || echo '{}')"
  verdict="null"; [ -f "$files/qa-verdict.json" ] && verdict="$(cat "$files/qa-verdict.json")"
  head="$(git log -1 --format='%h %s' 2>/dev/null || true)"
  # Every referenced file that isn't on disk (artifacts first, then evidence; #anchors stripped).
  missing="$(jq -r '[.artifacts[]?.file, (.acceptance[]?.evidence // [])[]] | reduce .[] as $f ([]; if index([$f]) then . else . + [$f] end) | .[]' "$qa/qa-manifest.json" \
    | while IFS= read -r f; do [ -f "$qa/${f%%#*}" ] || printf '%s\n' "$f"; done | jq -R . | jq -s .)"
  jq -n --slurpfile m "$qa/qa-manifest.json" --argjson s "$entry" --argjson v "$verdict" \
        --argjson missing "$missing" --arg head "$head" --arg now "$(orc_state__now)" '
    $m[0] as $m |
    { schema: 1, generatedAt: $now, branch: ($s.gitBranch // null), command: ($s.command // null),
      jiraTicket: ($s.jiraTicket // null), head: $head,
      verdict: ($v.verdict // $m.verdict), driver: $m.driver, summary: ($m.summary // ""),
      checks: [($v.checks // [])[] | select(.kind != "acceptance")],
      acceptance: [$m.acceptance[]? | {id, sliceId, criterion, result, note: (.note // ""), evidence: (.evidence // [])}],
      artifacts: [$m.artifacts[]? | {file, role: (.role // ""),
        kind: (if (.file | test("\\.(png|jpe?g|gif|webp)(#.*)?$"; "i")) then "image"
               elif (.file | test("\\.(webm|mp4)$"; "i")) then "video" else "file" end)}],
      curated: ($m.curated // []), target: ($m.target // null), video: ($m.video // null),
      specs: ($m.specs // []), tests: ($m.tests // []), missing: $missing }'
}

orc_report_html() { # [--branch B]
  local json sid qa tpl out
  json="$(orc_report_json "$@")" || return 1
  sid="$(orc_state__sid "$(printf '%s' "$json" | jq -r '.branch // empty')")" || return 1
  qa="$(orc_report__qa_dir "$sid")"
  tpl="$(dirname "${BASH_SOURCE[0]}")/report-template.html"
  out="$qa/report.html"
  # Every "<" becomes <: valid JSON, and the data can never close its <script>.
  ORC_REPORT_DATA="$(printf '%s' "$json" | sed 's/</\\u003c/g')" \
    awk '$0 == "__ORC_REPORT_DATA__" { print ENVIRON["ORC_REPORT_DATA"]; next } { print }' "$tpl" > "$out"
  printf '%s\n' "$out"
}

# One thumbnail, 240px wide: jpeg (small, for data: embeds) or png (the terminal Image takes png, not jpeg).
# sips on macOS, ffmpeg elsewhere; either may be absent.
orc_report__scaled() { # $1 = source image, $2 = destination, $3 = jpeg|png
  # 240 wide, then cropped to the top 150 rows so a full-page screenshot still fits the embed cap.
  if [ "$(uname -s)" = "Darwin" ] && command -v sips >/dev/null 2>&1; then
    sips -s format "$3" --resampleWidth 240 "$1" --out "$2" >/dev/null 2>&1 || return 1
    local h
    h="$(sips -g pixelHeight "$2" 2>/dev/null | awk '/pixelHeight/ { print $2 }')"
    if [ "${h:-0}" -gt 150 ] 2>/dev/null; then sips --cropToHeightWidth 150 240 --cropOffset 0 0 "$2" >/dev/null 2>&1 || return 1; fi
  elif command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -loglevel error -y -i "$1" -vf 'scale=240:-1,crop=240:min(150\,ih):0:0' -frames:v 1 -update 1 "$2" >/dev/null 2>&1
  else
    return 1
  fi
}

# 32x16 raw RGB (1,536 bytes) for the terminal's half-block fallback.
orc_report__rgb() { # $1 = source image, $2 = destination .rgb
  command -v ffmpeg >/dev/null 2>&1 || return 1
  ffmpeg -loglevel error -y -i "$1" -vf scale=32:16 -f rawvideo -pix_fmt rgb24 -frames:v 1 "$2" >/dev/null 2>&1
}

# Thumbnails of the first three existing image evidence files, written under files/qa/thumbs/.
# Prints [{ name, criterion, jpg, png, rgb }]; each is null when the tool is missing. Idempotent.
orc_report_thumbs() { # [--branch B]
  local branch="" sid qa th row file crit name jpg png rgb out="[]" hits=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) branch="${2:-}"; shift 2 ;;
      *) echo "orc-report: unknown argument $1" >&2; return 2 ;;
    esac
  done
  sid="$(orc_state__sid "$branch")" || return 1
  qa="$(orc_report__qa_dir "$sid")"
  [ -f "$qa/qa-manifest.json" ] || { echo "orc-report: no QA packet at $qa (run /orc:qa first)" >&2; return 1; }
  th="$qa/thumbs"
  while IFS= read -r row; do
    file="$(printf '%s' "$row" | jq -r .file)"; crit="$(printf '%s' "$row" | jq -r .criterion)"
    case "$file" in *..*|/*) continue ;; esac
    [ -f "$qa/$file" ] || continue
    mkdir -p "$th"
    # The name carries the whole relative path (test-results/<test>/x.png must not collide with y/x.png).
    name="${file%.*}"; name="${name#./}"; name="${name//\//__}"
    jpg="$th/$name.jpg"; png="$th/$name.png"; rgb="$th/$name.rgb"
    if ! { [ -s "$jpg" ] && [ "$jpg" -nt "$qa/$file" ]; }; then orc_report__scaled "$qa/$file" "$jpg" jpeg || rm -f "$jpg"; fi
    if ! { [ -s "$png" ] && [ "$png" -nt "$qa/$file" ]; }; then orc_report__scaled "$qa/$file" "$png" png || rm -f "$png"; fi
    if ! { [ -s "$rgb" ] && [ "$rgb" -nt "$qa/$file" ]; }; then orc_report__rgb "$qa/$file" "$rgb" || rm -f "$rgb"; fi
    [ -s "$jpg" ] || jpg=""
    [ -s "$png" ] || png=""
    [ -s "$rgb" ] || rgb=""
    out="$(jq -n --argjson o "$out" --arg n "$name" --arg c "$crit" --arg j "$jpg" --arg p "$png" --arg r "$rgb" \
      '$o + [{name: $n, criterion: $c, jpg: (if $j == "" then null else $j end), png: (if $p == "" then null else $p end), rgb: (if $r == "" then null else $r end)}]')"
    # Existence and traversal are filtered above, so the first three that survive are the ones shown.
    hits=$((hits + 1)); [ "$hits" -lt 3 ] || break
  done < <(jq -c '[.acceptance[]? | . as $a | ($a.evidence // [])[] | select(test("\\.(png|jpe?g)(#.*)?$"; "i")) | {file: sub("#.*$"; ""), criterion: $a.criterion}]
    | reduce .[] as $r ([]; if any(.[]; .file == $r.file) then . else . + [$r] end) | .[]' "$qa/qa-manifest.json")
  printf '%s\n' "$out"
}
