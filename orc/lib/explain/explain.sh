#!/usr/bin/env bash
# shellcheck disable=SC2016,SC2015
# explain.sh — the /orc:explain toolchain behind bin/orc-explain:
#   validate  segments.json shape (schema in orc:explainer references/segments-schema.md)
#   setup     stage narrate.mjs + package.json into ${XDG_CACHE_HOME:-~/.cache}/orc/explain and npm install
#   narrate   run kokoro-js → <work>/narration/<id>.wav
#   assemble  per-segment mp4 (clip | graphic from <work>/graphics/<id>.mp4 | fallback title card),
#             each max(video, narration) long, concat → --out
# ffmpeg/ffprobe required for assemble (exit 4 when absent — caller reports, never installs).

orc_ex__home() { printf '%s/orc/explain\n' "${XDG_CACHE_HOME:-$HOME/.cache}"; }
orc_ex__src()  { cd "$(dirname "${BASH_SOURCE[0]}")" && pwd; }

orc_ex_validate() { # --segments S
  local s=""
  while [ $# -gt 0 ]; do case "$1" in --segments) s="$2"; shift 2 ;; *) echo "orc-explain: unknown argument $1" >&2; return 2 ;; esac; done
  [ -f "$s" ] || { echo "orc-explain: segments file not found: $s" >&2; return 2; }
  local bad
  bad="$(jq -r '
    (if .schema != 1 then "schema must be 1" else empty end),
    (.segments // [] | to_entries[] | .value as $g |
      (if ($g.id // "") == "" then "segment \(.key): missing id" else empty end),
      (if ($g.narration // "") == "" then "segment \($g.id): missing narration" else empty end),
      (if ($g.kind != "graphic" and $g.kind != "clip") then "segment \($g.id): kind must be graphic|clip" else empty end),
      (if $g.kind == "clip" and ($g.source // "") == "" then "segment \($g.id): clip needs source" else empty end),
      (if $g.kind == "graphic" and ($g.title // "") == "" then "segment \($g.id): graphic needs title" else empty end))' "$s")"
  [ -z "$bad" ] || { printf 'orc-explain: invalid segments.json\n%s\n' "$bad" >&2; return 2; }
  printf 'ok %s segments\n' "$(jq '.segments | length' "$s")"
}

orc_ex_setup() {
  local home; home="$(orc_ex__home)"
  mkdir -p "$home"
  cp "$(orc_ex__src)/narrate.mjs" "$(orc_ex__src)/package.json" "$home/"
  if [ "${ORC_EXPLAIN_SKIP_NPM:-0}" != "1" ]; then
    (cd "$home" && npm install --no-fund --no-audit >/dev/null)
  fi
  printf '%s\n' "$home"
}

orc_ex_narrate() { # --segments S --work W
  local s="" w=""
  while [ $# -gt 0 ]; do case "$1" in --segments) s="$2"; shift 2 ;; --work) w="$2"; shift 2 ;; *) return 2 ;; esac; done
  local home; home="$(orc_ex__home)"
  [ -d "$home/node_modules/kokoro-js" ] || { echo "orc-explain: kokoro-js not installed — run: orc-explain setup" >&2; return 3; }
  node "$home/narrate.mjs" "$s" "$w/narration"
}

orc_ex__dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null || printf '0'; }
orc_ex__font() { local f; for f in /System/Library/Fonts/Helvetica.ttc /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf; do [ -f "$f" ] && { printf '%s' "$f"; return; }; done; }

# drawtext needs an ffmpeg built with libfreetype; Homebrew-minimal builds lack it.
orc_ex__has_drawtext() { ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' drawtext '; }

orc_ex__card() { # <out.mp4> <title> <lines-joined-by-\n> <seconds>
  local out="$1" title="$2" lines="$3" secs="$4" ff="" font t1 t2
  mkdir -p "$(dirname "$out")"
  if ! orc_ex__has_drawtext; then # no text rendering available — plain card, narration still carries the content
    echo "orc-explain: ffmpeg lacks drawtext — title card rendered without text" >&2
    ffmpeg -v error -y -f lavfi -i "color=c=0x1d1d1b:s=1920x1080:d=$secs" -r 30 -c:v libx264 -pix_fmt yuv420p -an "$out"
    return 0
  fi
  font="$(orc_ex__font)"; [ -n "$font" ] && ff="fontfile=$font:"
  t1="$(mktemp)"; t2="$(mktemp)"; printf '%s' "$title" > "$t1"; printf '%b' "$lines" > "$t2"
  ffmpeg -v error -y -f lavfi -i "color=c=0x1d1d1b:s=1920x1080:d=$secs" \
    -vf "drawtext=${ff}textfile=$t1:fontcolor=white:fontsize=72:x=(w-text_w)/2:y=h/2-160,drawtext=${ff}textfile=$t2:fontcolor=0xa29f98:fontsize=40:line_spacing=18:x=(w-text_w)/2:y=h/2-20" \
    -r 30 -c:v libx264 -pix_fmt yuv420p -an "$out"
  rm -f "$t1" "$t2"
}

orc_ex__segment() { # <video-in> <wav|""> <caption|""> <out.mp4> → renders video padded to max(video,narration) with audio
  local vin="$1" wav="$2" cap="$3" out="$4" vd ad target vf ff="" font tf
  vd="$(orc_ex__dur "$vin")"; ad=0; [ -n "$wav" ] && [ -f "$wav" ] && ad="$(orc_ex__dur "$wav")"
  target="$(awk -v a="$vd" -v b="$ad" 'BEGIN{printf "%.2f", (a>b?a:b)+0.3}')"
  vf="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,tpad=stop_mode=clone:stop_duration=$(awk -v t="$target" -v v="$vd" 'BEGIN{d=t-v; printf "%.2f", (d>0?d:0)}')"
  if [ -n "$cap" ] && orc_ex__has_drawtext; then
    font="$(orc_ex__font)"; [ -n "$font" ] && ff="fontfile=$font:"
    tf="$(mktemp)"; printf '%s' "$cap" > "$tf"
    vf="$vf,drawtext=${ff}textfile=$tf:fontcolor=white:fontsize=38:box=1:boxcolor=0x00000099:boxborderw=18:x=(w-text_w)/2:y=h-120"
  fi
  if [ -n "$wav" ] && [ -f "$wav" ]; then
    ffmpeg -v error -y -i "$vin" -i "$wav" -vf "$vf" -af "apad" -t "$target" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -ac 2 "$out"
  else
    ffmpeg -v error -y -i "$vin" -f lavfi -i anullsrc=r=48000:cl=stereo -vf "$vf" -t "$target" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "$out"
  fi
  [ -n "${tf:-}" ] && rm -f "$tf"
  return 0
}

orc_ex_assemble() { # --segments S --work W --qa-dir Q --out O
  local s="" w="" q="" o=""
  while [ $# -gt 0 ]; do case "$1" in --segments) s="$2"; shift 2 ;; --work) w="$2"; shift 2 ;; --qa-dir) q="$2"; shift 2 ;; --out) o="$2"; shift 2 ;; *) return 2 ;; esac; done
  command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 || { echo "orc-explain: ffmpeg not installed — explainer skipped" >&2; return 4; }
  orc_ex_validate --segments "$s" >/dev/null || return 2
  mkdir -p "$w/segments"; local list="$w/list.txt"; : > "$list"
  local id kind title lines src cap wav vin
  while IFS=$'\x1f' read -r id kind title lines src cap; do
    wav="$w/narration/$id.wav"; [ -f "$wav" ] || wav=""
    if [ "$kind" = "clip" ]; then
      vin="$q/$src"; [ -f "$vin" ] || { echo "orc-explain: clip source missing: $vin" >&2; return 1; }
    else
      vin="$w/graphics/$id.mp4"
      if [ ! -f "$vin" ]; then # fallback card when animate did not render this segment
        local secs; secs="$(awk -v a="$( [ -n "$wav" ] && orc_ex__dur "$wav" || printf 3 )" 'BEGIN{printf "%.2f", (a<3?3:a)}')"
        orc_ex__card "$vin" "$title" "$lines" "$secs"
      fi
      cap=""
    fi
    orc_ex__segment "$vin" "$wav" "$cap" "$w/segments/seg-$id.mp4"
    printf "file '%s'\n" "$w/segments/seg-$id.mp4" >> "$list"
  done < <(jq -r '.segments[] | [.id, .kind, (.title // ""), ((.lines // []) | join("\\n")), (.source // ""), (.caption // "")] | join("\u001f")' "$s")
  ffmpeg -v error -y -f concat -safe 0 -i "$list" -c copy "$o"
  printf '%s\n' "$o"
}

if [ "${BASH_SOURCE[0]:-}" = "${0:-}" ]; then
  set -euo pipefail
  sub="${1:-}"; shift 2>/dev/null || true
  case "$sub" in
    validate) orc_ex_validate "$@" ;;
    setup)    orc_ex_setup "$@" ;;
    narrate)  orc_ex_narrate "$@" ;;
    assemble) orc_ex_assemble "$@" ;;
    --help|-h|help|'') printf 'usage: orc-explain validate --segments S | setup | narrate --segments S --work W | assemble --segments S --work W --qa-dir Q --out O\n' ;;
    *) printf 'orc-explain: unknown subcommand %s\n' "$sub" >&2; exit 2 ;;
  esac
fi
