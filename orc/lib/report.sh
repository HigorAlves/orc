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
      curated: ($m.curated // []), missing: $missing }'
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
