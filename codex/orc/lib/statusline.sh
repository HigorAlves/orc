#!/usr/bin/env bash
# shellcheck disable=SC2016
# statusline.sh — renderer behind bin/orc-statusline (see docs: statusLine
# receives one JSON payload on stdin and prints rows). Design contract:
# two lines (work / machine), COLUMNS-aware degradation, NO_COLOR + ASCII
# fallback, every segment absent-tolerant, every path exits 0, <50ms.
# Sourced-library contract: MUST NOT set shell options.

ORC_SL_CACHE_TTL=5

# userConfig consumers (plugin.json keys statusline / statusline_style /
# statusline_context_reserve) — explicit reads so the wiring is greppable.
orc_sl_opt_enabled() { printf '%s' "${CLAUDE_PLUGIN_OPTION_STATUSLINE:-true}"; }
orc_sl_opt_style()   { printf '%s' "${CLAUDE_PLUGIN_OPTION_STATUSLINE_STYLE:-full}"; }
orc_sl_opt_reserve() { printf '%s' "${CLAUDE_PLUGIN_OPTION_STATUSLINE_CONTEXT_RESERVE:-0}"; }

# THE tier scale — single source shared with the context-monitor bridge hook.
orc_sl_context_tier() { # $1 = int pct
  local p="${1:-0}"
  if [ "$p" -ge 90 ] 2>/dev/null; then echo critical
  elif [ "$p" -ge 80 ] 2>/dev/null; then echo red
  elif [ "$p" -ge 60 ] 2>/dev/null; then echo yellow
  else echo green
  fi
}

orc_sl__mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }

orc_sl__strip_len() { # visible char length of $1 (ANSI stripped)
  printf '%s' "$1" | sed $'s/\x1b\\[[0-9;]*m//g' | wc -m | tr -d ' '
}

# Fill the place/git cache for this session: kind|branch|dirty|stateDir|place
orc_sl__git_cached() { # $1 = dir, $2 = session id → echoes the cache line
  local dir="$1" sid="${2:-nosession}" cache line top branch dirty place
  cache="${TMPDIR:-/tmp}/orc-sl-${sid}.git"
  if [ -f "$cache" ] && [ $(( $(date +%s) - $(orc_sl__mtime "$cache") )) -le "$ORC_SL_CACHE_TTL" ]; then
    cat "$cache"
    return 0
  fi
  if top="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)"; then
    branch="$(git -C "$dir" branch --show-current 2>/dev/null || true)"
    dirty=""
    [ -n "$(git -C "$dir" status --porcelain 2>/dev/null | head -1)" ] && dirty="*"
    line="repo|${branch}|${dirty}|${top}/.orc|$(basename "$top")"
  else
    # workspace parent or loose dir — count immediate child repos
    local n=0 live=0 child
    for child in "$dir"/*/; do
      [ -d "$child/.git" ] && n=$((n + 1))
    done
    if [ "$n" -ge 2 ]; then
      if [ -f "$dir/.orc/orc.json" ]; then
        live="$(jq '[.sessions[]? | select(.status == "in_progress")] | length' "$dir/.orc/orc.json" 2>/dev/null || echo 0)"
      fi
      line="workspace|||$dir/.orc|$(basename "$dir") (${n} repos)|${live}"
    else
      line="loose||||${dir/#$HOME/~}"
    fi
  fi
  ( umask 077; printf '%s\n' "$line" > "$cache.tmp" && mv "$cache.tmp" "$cache" ) 2>/dev/null || true
  find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'orc-sl-*' -mmin +1440 -delete 2>/dev/null || true
  printf '%s\n' "$line"
}

orc_sl_bridge_write() { # $1 = sid, $2 = raw pct, $3 = effective pct, $4 = tier
  local sid="$1" f warned=""
  [ -n "$sid" ] || return 0
  f="${TMPDIR:-/tmp}/orc-ctx-${sid}.json"
  [ -f "$f" ] && warned="$(jq -r '.warned_tier // ""' "$f" 2>/dev/null || true)"
  ( umask 077
    jq -cn --arg ts "$(date +%s)" --arg raw "$2" --arg eff "$3" --arg tier "$4" --arg w "$warned" \
      '{schema: 1, ts: ($ts|tonumber), raw_pct: ($raw|tonumber), effective_pct: ($eff|tonumber), tier: $tier, warned_tier: $w}' \
      > "$f.tmp" 2>/dev/null && mv "$f.tmp" "$f"
  ) 2>/dev/null || true
}

# Join non-empty segments with $SEP, dropping from the tail until it fits $W.
orc_sl__fit() { # $1 = W, then segments...
  local W="$1" out="" seg n
  shift
  local segs=("$@")
  n=${#segs[@]}
  while [ "$n" -gt 0 ]; do
    out=""
    local i=0
    while [ "$i" -lt "$n" ]; do
      seg="${segs[$i]}"
      if [ -n "$seg" ]; then
        if [ -n "$out" ]; then out="${out}${ORC_SL_SEP}${seg}"; else out="$seg"; fi
      fi
      i=$((i + 1))
    done
    if [ "$(orc_sl__strip_len "$out")" -le "$W" ]; then
      printf '%s' "$out"
      return 0
    fi
    n=$((n - 1))
  done
  printf '%s' ""
}

orc_statusline_render() { # $1 = raw stdin payload
  local payload="${1:-}"
  [ "$(orc_sl_opt_enabled)" = "false" ] && return 0

  # --- modes ---------------------------------------------------------------
  local color=1 utf=1 W style
  W="${COLUMNS:-100}"
  case "$W" in ''|*[!0-9]*) W=100 ;; esac
  style="$(orc_sl_opt_style)"
  [ -n "${NO_COLOR:-}" ] && { color=0; utf=0; }
  case "${LC_ALL:-${LANG:-}}" in *[Uu][Tt][Ff]-8*|*[Uu][Tt][Ff]8*) : ;; *) utf=0 ;; esac

  local C_DIM="" C_RST="" C_GRN="" C_YEL="" C_RED="" C_CYN="" C_MAG="" C_BLD=""
  if [ "$color" = 1 ]; then
    C_DIM=$'\033[2m' C_RST=$'\033[0m' C_GRN=$'\033[32m' C_YEL=$'\033[33m'
    C_RED=$'\033[31m' C_CYN=$'\033[36m' C_MAG=$'\033[35m' C_BLD=$'\033[1m'
  fi
  local GLY_BR="br " GLY_WT="+wt" FILL="#" EMPTY="-" BARL="[" BARR="]" MINUS="-" OK_M="" NO_M="" DR_M="" RV_M=""
  if [ "$utf" = 1 ]; then
    GLY_BR="⎇ " GLY_WT="⌗wt" FILL="▓" EMPTY="░" BARL="" BARR="" MINUS="−" OK_M="✔ " NO_M="✖ " DR_M="◌ " RV_M="● "
  fi
  ORC_SL_SEP=" ${C_DIM}|${C_RST} "
  [ "$utf" = 1 ] && ORC_SL_SEP=" ${C_DIM}│${C_RST} "

  # --- payload parse (ONE jq; garbage-tolerant) ----------------------------
  local P_MODEL="" P_EFFORT="" P_THINK="" P_FAST="" P_DIR="" P_REPO="" P_WT="" P_SID=""
  local P_CTX="" P_200K="" P_COST="" P_LA="" P_LR="" P_PRN="" P_PRS="" P_RL5="" P_RL5R="" P_RL7="" P_RL7R=""
  if [ -n "$payload" ]; then
    eval "$(printf '%s' "$payload" | jq -r '
      def s(v): (v // "") | tostring | @sh;
      "P_MODEL=" + s(.model.display_name),
      "P_EFFORT=" + s(.effort.level),
      "P_THINK=" + s(.thinking.enabled),
      "P_FAST=" + s(.fast_mode),
      "P_DIR=" + s(.workspace.current_dir // .cwd),
      "P_REPO=" + s(.workspace.repo.name),
      "P_WT=" + s(.workspace.git_worktree // .worktree.name),
      "P_SID=" + s(.session_id),
      "P_CTX=" + s(.context_window.used_percentage),
      "P_200K=" + s(.exceeds_200k_tokens),
      "P_COST=" + s(.cost.total_cost_usd),
      "P_LA=" + s(.cost.total_lines_added),
      "P_LR=" + s(.cost.total_lines_removed),
      "P_PRN=" + s(.pr.number),
      "P_PRS=" + s(.pr.review_state),
      "P_RL5=" + s(.rate_limits.five_hour.used_percentage),
      "P_RL5R=" + s(.rate_limits.five_hour.resets_at),
      "P_RL7=" + s(.rate_limits.seven_day.used_percentage),
      "P_RL7R=" + s(.rate_limits.seven_day.resets_at)
    ' 2>/dev/null || true)"
  fi
  [ -n "$P_DIR" ] || P_DIR="$PWD"

  # --- place / git (cached) ------------------------------------------------
  local kind="" branch="" dirty="" statedir="" place="" wslive=""
  IFS='|' read -r kind branch dirty statedir place wslive <<EOF
$(orc_sl__git_cached "$P_DIR" "${P_SID:-nosession}")
EOF

  # --- orc session (shared selector from lib/state.sh) ---------------------
  local S_CMD="" S_PHASE="" S_TOTAL="" S_LABEL="" S_JIRA="" S_SD="" S_ST="" S_POLICY="" sline=""
  if type orc_state_line >/dev/null 2>&1 && [ -n "$statedir" ] && [ -f "$statedir/orc.json" ]; then
    sline="$(ORC_STATE_DIR="$statedir" orc_state_line --branch "${branch:-}" 2>/dev/null || true)"
  fi
  if [ -n "$sline" ]; then
    eval "$(printf '%s' "$sline" | jq -r '
      def s(v): (v // "") | tostring | @sh;
      "S_CMD=" + s(.command),
      "S_PHASE=" + s(.phase),
      "S_TOTAL=" + s(.totalPhases),
      "S_LABEL=" + s(.phaseLabel),
      "S_JIRA=" + s(.jiraTicket),
      "S_SD=" + s(.slicesDone),
      "S_ST=" + s(.slicesTotal),
      "S_POLICY=" + s(.policy)
    ' 2>/dev/null || true)"
  fi

  # --- line 1 segments -----------------------------------------------------
  local seg_orc="" seg_jira="" seg_slices="" seg_policy="" seg_branch="" seg_pr="" seg_place=""
  if [ -n "$S_CMD" ]; then
    local ph="$S_PHASE"
    [ -n "$S_TOTAL" ] && ph="${S_PHASE}/${S_TOTAL}"
    seg_orc="${C_DIM}orc${C_RST} ${C_BLD}${C_CYN}${S_CMD} ${ph}${C_RST}"
    [ -n "$S_LABEL" ] && seg_orc="${seg_orc} ${S_LABEL}"
  else
    seg_orc="${C_DIM}orc${C_RST}"
  fi
  [ -n "$S_JIRA" ] && seg_jira="${C_DIM}${S_JIRA}${C_RST}"
  [ -n "$S_ST" ] && seg_slices="slices ${S_SD:-0}/${S_ST}"
  if [ -n "$S_POLICY" ] && [ "$S_POLICY" != "manual" ]; then
    seg_policy="${C_YEL}${S_POLICY}${C_RST}"
    [ "$S_POLICY" = "guided" ] && seg_policy="${C_DIM}guided${C_RST}"
  fi
  if [ "$kind" = "repo" ] && [ -n "$branch" ]; then
    seg_branch="${C_GRN}${GLY_BR}${branch}${C_RST}"
    [ -n "$dirty" ] && seg_branch="${seg_branch}${C_RED}*${C_RST}"
    [ -n "$P_WT" ] && seg_branch="${seg_branch} ${C_DIM}${GLY_WT}${C_RST}"
  fi
  if [ -n "$P_PRN" ]; then
    case "$P_PRS" in
      approved)          seg_pr="${C_GRN}#${P_PRN} ${OK_M}approved${C_RST}" ;;
      changes_requested) seg_pr="${C_RED}#${P_PRN} ${NO_M}changes${C_RST}" ;;
      draft)             seg_pr="${C_DIM}#${P_PRN} ${DR_M}draft${C_RST}" ;;
      *)                 seg_pr="${C_YEL}#${P_PRN} ${RV_M}review${C_RST}" ;;
    esac
  fi
  case "$kind" in
    repo)      [ -n "$P_REPO" ] && seg_place="${C_DIM}${P_REPO}${C_RST}" ;;
    workspace) seg_place="${C_DIM}${place}${C_RST}"
               [ -n "$wslive" ] && [ "$wslive" != "0" ] && seg_place="${seg_place}${ORC_SL_SEP}${wslive} live" ;;
    *)         seg_place="${C_DIM}${place:-$P_DIR}${C_RST}" ;;
  esac

  # --- line 2 segments -----------------------------------------------------
  local seg_model="" seg_ctx="" seg_cost="" seg_rate=""
  if [ -n "$P_MODEL" ]; then
    seg_model="$P_MODEL"
    if [ -n "$P_EFFORT" ]; then
      case "$P_EFFORT" in
        low) seg_model="${seg_model} ${C_DIM}low${C_RST}" ;;
        high|xhigh|max) seg_model="${seg_model} ${C_MAG}${P_EFFORT}${C_RST}" ;;
        *) seg_model="${seg_model} ${P_EFFORT}" ;;
      esac
    fi
    [ "$P_THINK" = "true" ] && seg_model="${seg_model} ${C_DIM}think${C_RST}"
    [ "$P_FAST" = "true" ] && seg_model="${seg_model} ${C_YEL}fast${C_RST}"
  fi
  local pct="" eff="" tier="" pfx=""
  if [ -n "$P_CTX" ]; then
    pct="${P_CTX%%.*}"
    eff="$pct"
    local reserve
    reserve="$(orc_sl_opt_reserve)"
    case "$reserve" in ''|*[!0-9]*) reserve=0 ;; esac
    if [ "$reserve" -gt 0 ] && [ "$reserve" -lt 100 ]; then
      eff=$(( pct * 100 / (100 - reserve) ))
      [ "$eff" -gt 100 ] && eff=100
      pfx="~"
    fi
    tier="$(orc_sl_context_tier "$eff")"
    local cells=$(( (eff + 5) / 10 )) bar="" i=0 tc=""
    [ "$cells" -gt 10 ] && cells=10
    while [ "$i" -lt "$cells" ]; do bar="${bar}${FILL}"; i=$((i + 1)); done
    while [ "$i" -lt 10 ]; do bar="${bar}${EMPTY}"; i=$((i + 1)); done
    case "$tier" in
      green) tc="$C_GRN" ;; yellow) tc="$C_YEL" ;; *) tc="$C_RED" ;;
    esac
    seg_ctx="ctx ${tc}${BARL}${bar}${BARR} ${pfx}${eff}%${C_RST}"
    [ "$tier" = "critical" ] && seg_ctx="${seg_ctx}${C_RED}${C_BLD}!${C_RST}"
    [ "$P_200K" = "true" ] && seg_ctx="${seg_ctx} ${C_RED}!200k${C_RST}"
    orc_sl_bridge_write "$P_SID" "$pct" "$eff" "$tier"
  fi
  if [ -n "$P_COST" ]; then
    seg_cost="$(printf '$%.2f' "$P_COST" 2>/dev/null || printf '$%s' "$P_COST")"
    if [ -n "$P_LA" ] || [ -n "$P_LR" ]; then
      seg_cost="${seg_cost} ${C_GRN}+${P_LA:-0}${C_RST}/${C_RED}${MINUS}${P_LR:-0}${C_RST}"
    fi
  fi
  local rl="" rlw="" rlr=""
  if [ -n "$P_RL5" ] || [ -n "$P_RL7" ]; then
    local r5="${P_RL5%%.*}" r7="${P_RL7%%.*}"
    if [ "${r5:-0}" -ge "${r7:-0}" ] 2>/dev/null; then rl="${r5:-0}"; rlw="5h"; rlr="$P_RL5R"; else rl="${r7:-0}"; rlw="7d"; rlr="$P_RL7R"; fi
    if [ "${rl:-0}" -ge 50 ] 2>/dev/null; then
      local rc="$C_YEL"
      seg_rate="${rlw} ${rl}%"
      if [ "$rl" -ge 85 ] 2>/dev/null; then
        rc="$C_RED"
        local rt=""
        [ -n "$rlr" ] && rt="$(date -r "$rlr" +%H:%M 2>/dev/null || date -d "@$rlr" +%H:%M 2>/dev/null || true)"
        [ -n "$rt" ] && seg_rate="${seg_rate} ${utf:+→}${rt}"
        [ "$utf" = 0 ] && [ -n "$rt" ] && seg_rate="${rlw} ${rl}% ->${rt}"
      fi
      seg_rate="${rc}${seg_rate}${C_RST}"
    fi
  fi

  # --- assemble by width tier ----------------------------------------------
  if [ "$W" -lt 60 ]; then
    local minimal=""
    if [ -n "$S_CMD" ]; then minimal="${S_CMD} ${S_PHASE}${S_TOTAL:+/$S_TOTAL}"; else minimal="${branch:-${place:-orc}}"; fi
    [ -n "$pct" ] && minimal="${minimal} ${pfx}${eff}%"
    printf '%s\n' "$(printf '%s' "$minimal" | awk -v w="$W" '{print substr($0, 1, w)}')"
    return 0
  fi
  if [ "$W" -lt 80 ] || [ "$style" = "compact" ]; then
    # single plain line (no ANSI) — width guarantee by construction
    local one="" b1="${branch:-}"
    [ -n "$b1" ] && [ "${#b1}" -gt 16 ] && b1="${b1:0:15}…"
    if [ -n "$S_CMD" ]; then one="${S_CMD} ${S_PHASE}${S_TOTAL:+/$S_TOTAL}"; else one="${b1:-${place:-orc}}"; b1=""; fi
    [ -n "$b1" ] && one="${one} | ${b1}${dirty}"
    [ -n "$pct" ] && one="${one} | ${pfx}${eff}%"
    [ -n "$P_MODEL" ] && one="${one} | ${P_MODEL}"
    [ -n "$P_COST" ] && one="${one} | $(printf '$%.2f' "$P_COST" 2>/dev/null || true)"
    printf '%s\n' "$(printf '%s' "$one" | awk -v w="$W" '{print substr($0, 1, w)}')"
    return 0
  fi
  if [ "$W" -lt 100 ]; then
    # medium: shed tail detail
    seg_place=""; seg_policy=""
    [ -n "$S_ST" ] && seg_slices="${S_SD:-0}/${S_ST}"
    [ -n "$P_PRN" ] && seg_pr="${seg_pr%% *}${C_RST}"
    [ -n "$P_COST" ] && seg_cost="$(printf '$%.2f' "$P_COST" 2>/dev/null || true)"
  fi
  local l1 l2
  l1="$(orc_sl__fit "$W" "$seg_orc" "$seg_jira" "$seg_slices" "$seg_policy" "$seg_branch" "$seg_pr" "$seg_place")"
  l2="$(orc_sl__fit "$W" "$seg_model" "$seg_ctx" "$seg_cost" "$seg_rate")"
  [ -n "$l1" ] && printf '%b\n' "$l1"
  [ -n "$l2" ] && printf '%b\n' "$l2"
  return 0
}
