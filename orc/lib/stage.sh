#!/usr/bin/env bash
# shellcheck disable=SC2016  # $vars inside single quotes are jq program variables
# stage.sh — factory stage packs: list, validate, render.
# Sourced by bin/orc-stage. Pure bash + jq; no sed on user text (criteria may
# contain slashes and ampersands), placeholders are substituted by jq split/join.
# Contract schemas: orc/factory/schema/*.json.

ORC_STAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORC_STAGE_IDS='["triage","test_design","implementing","verifying","e2e","evidence","ci_watch","reviewing_memory"]'

orc_stage__packs_file() { printf '%s\n' "${ORC_FACTORY_STAGES:-${ORC_STAGE_ROOT}/factory/stages.json}"; }

orc_stage__die() { # <code> <message>
  echo "orc-stage: $2" >&2
  return "$1"
}

# Prints one line per pack: <id>\t<agent|script>\t<writable>\t<tools,joined>
orc_stage_packs() {
  local f
  f="$(orc_stage__packs_file)"
  jq -r '.packs | to_entries[] | [.key, (.value.agent // "script"), (.value.writable|tostring), (.value.tools|join(","))] | @tsv' "$f"
}

# <schema> <file> — structural check (required keys, enums, types).
# <schema> is a path to a contract schema; its basename picks the check.
# Exit 0 valid; 1 with the first failing key on stderr; 2 on unreadable file.
orc_stage_validate_jq() {
  local schema="$1" file="$2" kind key
  jq empty "$file" 2>/dev/null || { echo "orc-stage: $file is not valid JSON" >&2; return 2; }
  case "$(basename "$schema")" in
    stage-input.json) kind=input ;;
    stage-output.json) kind=output ;;
    stages.json) kind=stages ;;
    *) echo "orc-stage: unknown schema $schema" >&2; return 2 ;;
  esac
  key="$(jq -r --arg kind "$kind" --argjson ids "$ORC_STAGE_IDS" '
    def checks:
      if $kind == "input" then [
        ["schema", .schema==1],
        ["stage", (.stage|type)=="string"],
        ["pack", (.pack as $p | $ids|index($p)!=null)],
        ["attempt", (.attempt|type)=="number"],
        ["task", (.task|type)=="object"],
        ["plan", ((.plan|type)=="object" or .plan==null)],
        ["decisions", (.decisions|type)=="array"],
        ["priorFindings", (.priorFindings|type)=="array"],
        ["context", (.context|type)=="object"],
        ["limits.maxTurns", (.limits.maxTurns|type)=="number"],
        ["limits.timeoutMs", (.limits.timeoutMs|type)=="number"],
        ["env", (.env|type)=="object"]]
      elif $kind == "output" then [
        ["schema", .schema==1],
        ["ok", (.ok|type)=="boolean"],
        ["outcome", (.outcome|IN("pass","fail","needs_input","test_change"))],
        ["summary", (.summary|type)=="string"],
        ["requested", (.requested|type)=="array"],
        ["findings", (.findings|type)=="array"],
        ["artifacts", (.artifacts|type)=="array"],
        ["artifacts[].kind", ((.artifacts|type)=="array") and all(.artifacts[]; .kind|IN("qa-manifest","screenshot","video","har","report","test","diff","findings","rules"))],
        ["requested[].kind", ((.requested|type)=="array") and all(.requested[]; .kind|IN("tracker_write","pr_review_post","publish"))],
        ["slices.done", (.slices.done|type)=="number"],
        ["slices.total", (.slices.total|type)=="number"],
        ["usage", (.usage|type)=="object"],
        ["rateLimited", (.rateLimited|type)=="boolean"]]
      else [
        ["schema", .schema==1],
        ["packs", (.packs|type)=="object"],
        ["packs ids", ((.packs|type)=="object") and ((.packs|keys|sort) == ($ids|sort))]]
      end;
    (try (checks | map(select(.[1] != true)) | .[0][0]) catch "(root)") // empty' "$file")" || key="(root)"
  if [ -n "$key" ]; then
    echo "orc-stage: $file fails $kind check at key: $key" >&2
    return 1
  fi
  return 0
}

# validate --input F | --output F | --packs
orc_stage_validate() {
  local sdir="${ORC_STAGE_ROOT}/factory/schema"
  case "${1:-}" in
    --input)  [ -n "${2:-}" ] || { orc_stage__die 2 "validate --input needs a file"; return; }
              orc_stage_validate_jq "$sdir/stage-input.json" "$2" ;;
    --output) [ -n "${2:-}" ] || { orc_stage__die 2 "validate --output needs a file"; return; }
              orc_stage_validate_jq "$sdir/stage-output.json" "$2" ;;
    --packs)  orc_stage_validate_jq "$sdir/stages.json" "$(orc_stage__packs_file)" ;;
    *)        orc_stage__die 2 "validate: expected --input <file> | --output <file> | --packs" ;;
  esac
}

# Built-in template, used when the pack's promptTemplate file does not exist.
orc_stage__default_template() {
  cat <<'TPL'
## Task
Title: {{task.title}}
Branch: {{task.branch}}

{{task.description}}

Acceptance criteria:
{{task.criteria}}

## Plan
Brief: {{plan.brief}}

Plan criteria:
{{plan.criteria}}

Assumptions:
{{plan.assumptions}}

## Decisions so far
{{decisions}}

## Prior findings
{{priorFindings}}

## Project context
{{context.projectContext}}

## Run
Attempt {{attempt}} as {{agent}}. Skills: {{skills}}
TPL
}

# Resolve a promptTemplate path: as given, then relative to the plugin root
# (with and without the leading "orc/"). Prints nothing when absent.
orc_stage__template_path() { # <promptTemplate>
  local p="$1" c
  [ -n "$p" ] || return 0
  for c in "$p" "${ORC_STAGE_ROOT}/../$p" "${ORC_STAGE_ROOT}/${p#orc/}"; do
    if [ -f "$c" ]; then printf '%s\n' "$c"; return 0; fi
  done
}

# render <pack> <stage.json> — stage prompt to stdout.
orc_stage_render() {
  local pack="${1:-}" input="${2:-}" pf tpl_rel tpl_file tpl
  if [ -z "$pack" ] || [ -z "$input" ]; then orc_stage__die 2 "render <pack> <stage.json>"; return; fi
  pf="$(orc_stage__packs_file)"
  jq -e --arg p "$pack" '.packs[$p]' "$pf" >/dev/null 2>&1 \
    || { orc_stage__die 2 "unknown pack: $pack"; return; }
  if ! { [ -f "$input" ] && jq empty "$input" 2>/dev/null; }; then
    orc_stage__die 2 "cannot read stage input: $input"; return
  fi
  tpl_rel="$(jq -r --arg p "$pack" '.packs[$p].promptTemplate // ""' "$pf")"
  tpl_file="$(orc_stage__template_path "$tpl_rel")"
  if [ -n "$tpl_file" ]; then tpl="$(cat "$tpl_file")"; else tpl="$(orc_stage__default_template)"; fi

  jq -rn --arg pack "$pack" --arg tpl "$tpl" --slurpfile packs "$pf" --slurpfile in "$input" '
    def txt: if . == null or . == "" then "(none)" else tostring end;
    def bullets: if . == null or length == 0 then "(none)" else map("- " + tostring) | join("\n") end;
    def lines(f): if . == null or length == 0 then "(none)" else map(f) | join("\n") end;
    ($packs[0].packs[$pack]) as $pk | ($in[0]) as $i |
    ($pk.agent // "script") as $agent |
    {
      "{{task.title}}": ($i.task.title | txt),
      "{{task.description}}": ($i.task.description | txt),
      "{{task.criteria}}": ($i.task.criteria | bullets),
      "{{task.branch}}": ($i.task.branch | txt),
      "{{plan.brief}}": ($i.plan.brief? | txt),
      "{{plan.criteria}}": ($i.plan.criteria? | bullets),
      "{{plan.assumptions}}": ($i.plan.assumptions? | bullets),
      "{{decisions}}": ($i.decisions | lines("- \(.decision) at \(.at): \(if (.reason // "") != "" then .reason elif (.answers // {}) != {} then (.answers|tojson) else "(none)" end)")),
      "{{priorFindings}}": ($i.priorFindings | lines("- \(.severity) \(.path):\(.line) \(.title)")),
      "{{context.projectContext}}": ($i.context.projectContext | txt),
      "{{attempt}}": ($i.attempt | txt),
      "{{agent}}": $agent,
      "{{skills}}": (($pk.skills // []) | if length == 0 then "(none)" else join(", ") end)
    } as $subs |
    "You are the `\($agent)` role running the `\($pack)` stage in factory mode (ORC_FACTORY=1). Follow orc:gates §8: no AskUserQuestion; questions end the stage as needs_input; outward actions go to requested[]. Answer with JSON matching the pack outputSchema.",
    ($pk.outputSchema | tojson),
    "",
    (reduce ($subs | to_entries[]) as $e ($tpl; split($e.key) | join($e.value)))'
}

# run — SDK runner; implemented in slice 5.
orc_stage_run() {
  echo "orc-stage run: not implemented (slice 5)" >&2
  return 3
}
