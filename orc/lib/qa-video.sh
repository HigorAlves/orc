#!/usr/bin/env bash
# shellcheck disable=SC2015,SC2016
# qa-video.sh — turns a Playwright run into QA evidence: an ordered scenario
# plan from results.json, per-test console/trace collection into the packet,
# and the single stitched qa-<branch>.webm (title card + clip per scenario)
# with chapters.json timestamps. Behind bin/orc-qa-video. Needs ffmpeg/ffprobe
# only for `stitch` (exit 4 when absent — the caller says so, never installs).

orc_qv__slug() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'; }

orc_qv_plan() { # --results R → JSON array [{id,title,file,outcome,video,console,trace}]
  local results=""
  while [ $# -gt 0 ]; do case "$1" in --results) results="$2"; shift 2 ;; *) echo "orc-qa-video: unknown argument $1" >&2; return 2 ;; esac; done
  [ -f "$results" ] || { echo "orc-qa-video: results.json not found: $results" >&2; return 1; }
  jq -c '
    def specs: .specs[]?, (.suites[]? | specs);
    [ .suites[] | specs
      | . as $spec
      | $spec.tests[] | select(.projectName != "setup")
      | (.results | last) as $r
      | { title: $spec.title, file: $spec.file, outcome: $r.status,
          video:   ([$r.attachments[]? | select(.name == "video")       | .path] | first),
          console: ([$r.attachments[]? | select(.name == "console.log") | .path] | first),
          trace:   ([$r.attachments[]? | select(.name == "trace")       | .path] | first) } ]' "$results" \
  | jq -c 'reduce .[] as $s ({seen: {}, out: []};
      ($s.title | ascii_downcase | gsub("[^a-z0-9]+"; "-") | gsub("^-+|-+$"; "")) as $base
      | (.seen[$base] // 0) as $k | .seen[$base] = $k + 1
      | .out += [$s + {id: (if $k == 0 then $base else "\($base)-\($k + 1)" end)}]) | .out'
}

orc_qv_collect() { # --results R --qa-dir D → copies console-<id>.log, trace-<id>.zip
  local results="" qa=""
  while [ $# -gt 0 ]; do case "$1" in --results) results="$2"; shift 2 ;; --qa-dir) qa="$2"; shift 2 ;; *) return 2 ;; esac; done
  [ -d "$qa" ] || mkdir -p "$qa"
  local id console trace
  while IFS=$'\t' read -r id console trace; do
    [ -n "$console" ] && [ "$console" != "null" ] && [ -f "$console" ] && cp "$console" "$qa/console-$id.log"
    [ -n "$trace" ]   && [ "$trace"   != "null" ] && [ -f "$trace" ]   && cp "$trace"   "$qa/trace-$id.zip"
    printf 'collected %s\n' "$id"
  done < <(orc_qv_plan --results "$results" | jq -r '.[] | [.id, (.console // "null"), (.trace // "null")] | @tsv')
}

orc_qv__font() { # first usable font file for drawtext, or empty (fontconfig fallback)
  local f
  for f in /System/Library/Fonts/Helvetica.ttc /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /usr/share/fonts/dejavu/DejaVuSans.ttf; do
    [ -f "$f" ] && { printf '%s' "$f"; return 0; }
  done
}

orc_qv__card() { # <out.webm> <title> <subtitle> <seconds> <WxH>
  local out="$1" title="$2" sub="$3" secs="$4" size="$5" font tf1 tf2 ff=""
  if ! ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' drawtext '; then
    # ffmpeg built without libfreetype: blank card (chapters.json still carries titles)
    ffmpeg -nostdin -v error -y -f lavfi -i "color=c=0x1d1d1b:s=$size:d=$secs" -r 25 -c:v libvpx -b:v 1M -an "$out"
    return
  fi
  font="$(orc_qv__font)"; [ -n "$font" ] && ff="fontfile=$font:"
  tf1="$(mktemp)"; tf2="$(mktemp)"; printf '%s' "$title" > "$tf1"; printf '%s' "$sub" > "$tf2"
  ffmpeg -nostdin -v error -y -f lavfi -i "color=c=0x1d1d1b:s=$size:d=$secs" \
    -vf "drawtext=${ff}textfile=$tf1:fontcolor=white:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2-30,drawtext=${ff}textfile=$tf2:fontcolor=0xa29f98:fontsize=26:x=(w-text_w)/2:y=(h-text_h)/2+40" \
    -r 25 -c:v libvpx -b:v 1M -an "$out"
  rm -f "$tf1" "$tf2"
}

orc_qv__dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

orc_qv_stitch() { # --results R --qa-dir D --branch B [--card-seconds 2] [--size 1280x720]
  local results="" qa="" branch="" card=2 size="1280x720"
  while [ $# -gt 0 ]; do
    case "$1" in
      --results) results="$2"; shift 2 ;; --qa-dir) qa="$2"; shift 2 ;; --branch) branch="$2"; shift 2 ;;
      --card-seconds) card="$2"; shift 2 ;; --size) size="$2"; shift 2 ;;
      *) echo "orc-qa-video: unknown argument $1" >&2; return 2 ;;
    esac
  done
  command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 || { echo "orc-qa-video: ffmpeg not installed — motion proof skipped" >&2; return 4; }
  [ -n "$branch" ] && [ -n "$qa" ] || { echo "orc-qa-video: stitch needs --qa-dir and --branch" >&2; return 2; }
  mkdir -p "$qa"
  local work list chapters="[]" t=0 n=0 id title outcome video seg cardf d1 d2
  work="$(mktemp -d)"; list="$work/list.txt"; : > "$list"
  while IFS=$'\t' read -r id title outcome video; do
    [ -n "$video" ] && [ "$video" != "null" ] && [ -f "$video" ] || continue
    n=$((n+1))
    cardf="$work/card-$n.webm"
    orc_qv__card "$cardf" "$title" "$(printf 'scenario %d — %s' "$n" "$outcome")" "$card" "$size"
    seg="$work/seg-$n.webm"
    ffmpeg -nostdin -v error -y -i "$video" -vf "scale=${size/x/:}:force_original_aspect_ratio=decrease,pad=${size/x/:}:(ow-iw)/2:(oh-ih)/2,fps=25" -c:v libvpx -b:v 1M -an "$seg"
    d1="$(orc_qv__dur "$cardf")"; d2="$(orc_qv__dur "$seg")"
    chapters="$(printf '%s' "$chapters" | jq --arg id "$id" --arg title "$title" --arg outcome "$outcome" --arg f "$(basename "$video")" \
      --argjson start "$(awk -v t="$t" -v c="$d1" 'BEGIN{printf "%.2f", t+c}')" --argjson end "$(awk -v t="$t" -v c="$d1" -v d="$d2" 'BEGIN{printf "%.2f", t+c+d}')" \
      '. + [{id: $id, title: $title, outcome: $outcome, source: $f, start: $start, end: $end}]')"
    t="$(awk -v t="$t" -v c="$d1" -v d="$d2" 'BEGIN{printf "%.2f", t+c+d}')"
    printf "file '%s'\nfile '%s'\n" "$cardf" "$seg" >> "$list"
  done < <(orc_qv_plan --results "$results" | jq -r '.[] | [.id, .title, .outcome, (.video // "null")] | @tsv')
  [ "$n" -gt 0 ] || { echo "orc-qa-video: no scenario videos found in $results" >&2; rm -rf "$work"; return 1; }
  ffmpeg -nostdin -v error -y -f concat -safe 0 -i "$list" -c copy "$qa/qa-$branch.webm"
  printf '%s\n' "$chapters" > "$qa/chapters.json"
  rm -rf "$work"
  printf '%s\n%s\n' "$qa/qa-$branch.webm" "$qa/chapters.json"
}

if [ "${BASH_SOURCE[0]:-}" = "${0:-}" ]; then
  set -euo pipefail
  sub="${1:-}"; shift 2>/dev/null || true
  case "$sub" in
    plan)    orc_qv_plan "$@" ;;
    collect) orc_qv_collect "$@" ;;
    stitch)  orc_qv_stitch "$@" ;;
    --help|-h|help|'') printf 'usage: orc-qa-video plan --results R | collect --results R --qa-dir D | stitch --results R --qa-dir D --branch B [--card-seconds N] [--size WxH]\n' ;;
    *) printf 'orc-qa-video: unknown subcommand %s\n' "$sub" >&2; exit 2 ;;
  esac
fi
