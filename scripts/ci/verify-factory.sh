#!/usr/bin/env bash
# Integrity of the factory stage packs and the cross-repo contract schemas:
#   - packs:    exactly the 8 stage ids; each agent exists, each tool is a
#               verbatim entry of that agent's `tools:` frontmatter, each skill
#               has a directory under orc/skills/, scalar fields have the right type;
#   - schemas:  the three schema files are valid JSON;
#   - fixtures: example input/output validate, the broken ones do not.
# Validation uses ajv-cli (draft 2020) when node + network allow, else a jq
# structural check (required keys, enums). The path that ran is printed.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

packs=orc/factory/stages.json
sdir=orc/factory/schema
fx=scripts/ci/fixtures/factory
status=0

fail() { echo "verify-factory: $1"; status=1; }

ids='["triage","test_design","implementing","verifying","e2e","evidence","ci_watch","reviewing_memory"]'

for f in "$packs" "$sdir/stage-input.json" "$sdir/stage-output.json" "$sdir/stages.json"; do
  jq empty "$f" 2>/dev/null || { fail "$f is missing or not valid JSON"; exit 1; }
done

jq -e --argjson ids "$ids" '(.packs | keys | sort) == ($ids | sort)' "$packs" >/dev/null \
  || fail "$packs must define exactly: $(jq -r 'join(" ")' <<<"$ids")"

for id in $(jq -r '.packs | keys[]' "$packs"); do
  p() { jq -r --arg id "$id" ".packs[\$id]$1" "$packs"; }
  jq -e --arg id "$id" '.packs[$id] | (.writable|type)=="boolean" and (.maxTurns|type)=="number" and (.timeoutMs|type)=="number" and (.maxTurns==(.maxTurns|floor)) and (.timeoutMs==(.timeoutMs|floor)) and (.skills|type)=="array" and (.tools|type)=="array" and (.outputSchema|type)=="object" and (.promptTemplate|type)=="string"' "$packs" >/dev/null \
    || fail "$id: writable/maxTurns/timeoutMs/skills/tools/outputSchema/promptTemplate have wrong types"
  [ "$(p .promptTemplate)" = "orc/factory/prompts/$id.md" ] || fail "$id: promptTemplate must be orc/factory/prompts/$id.md"

  agent=$(p '.agent // ""')
  if [ -n "$agent" ]; then
    af="orc/agents/$agent.md"
    if [ ! -f "$af" ]; then
      fail "$id: agent '$agent' has no $af"
    else
      line=$(grep -m1 '^tools:' "$af" | sed 's/^tools:[[:space:]]*//')
      while IFS= read -r tool; do
        [ -n "$tool" ] || continue
        if ! printf '%s\n' "$line" | awk -F', ' '{for(i=1;i<=NF;i++)print $i}' | grep -qxF -- "$tool"; then
          fail "$id: tool '$tool' is not in $af tools:"
        fi
      done < <(jq -r --arg id "$id" '.packs[$id].tools[]' "$packs")
    fi
  else
    [ "$(jq -r --arg id "$id" '.packs[$id].tools | length' "$packs")" = "0" ] || fail "$id: agent is null but tools is not empty"
  fi

  while IFS= read -r skill; do
    [ -n "$skill" ] || continue
    case "$skill" in
      orc:*) [ -d "orc/skills/${skill#orc:}" ] || fail "$id: skill '$skill' has no orc/skills/${skill#orc:}/" ;;
      *) fail "$id: skill '$skill' must be an orc:<skill> id" ;;
    esac
  done < <(jq -r --arg id "$id" '.packs[$id].skills[]' "$packs")
done

# ---- schema validation: ajv when available, else jq structural fallback ----
use_ajv=0
if command -v npx >/dev/null 2>&1 && npx --yes ajv-cli@5 help >/dev/null 2>&1; then use_ajv=1; fi
echo "verify-factory: validation path = $([ "$use_ajv" = 1 ] && echo ajv || echo jq-fallback)"

# jq fallback: required keys, enums, top-level types per the contract schemas.
jq_check() { # kind file
  case "$1" in
    input) jq -e --argjson ids "$ids" '
      (.schema|IN(1,2,3)) and (.stage|type)=="string" and (.pack as $p | $ids|index($p)!=null)
      and (.attempt|type)=="number" and (.task|type)=="object"
      and ((.plan|type)=="object" or .plan==null)
      and (.decisions|type)=="array" and (.priorFindings|type)=="array" and (.context|type)=="object"
      and (.limits.maxTurns|type)=="number" and (.limits.timeoutMs|type)=="number" and (.env|type)=="object"' "$2" >/dev/null ;;
    output) jq -e '
      .schema==1 and (.ok|type)=="boolean" and (.outcome|IN("pass","fail","needs_input","test_change"))
      and (.summary|type)=="string" and (.requested|type)=="array" and (.findings|type)=="array"
      and (.artifacts|type)=="array"
      and all(.artifacts[]; .kind|IN("qa-manifest","screenshot","video","har","report","test","diff","findings","rules"))
      and all(.requested[]; .kind|IN("tracker_write","pr_review_post","publish"))
      and (.slices.done|type)=="number" and (.slices.total|type)=="number"
      and (.usage|type)=="object" and (.rateLimited|type)=="boolean"' "$2" >/dev/null ;;
    stages) jq -e '.schema==1 and (.packs|type)=="object"' "$2" >/dev/null ;;
  esac
}

validate() { # kind schema file
  if [ "$use_ajv" = 1 ]; then
    npx --yes ajv-cli@5 validate --spec=draft2020 -s "$2" -d "$3" >/dev/null 2>&1
  else
    jq_check "$1" "$3"
  fi
}

validate input "$sdir/stage-input.json" "$fx/stage-input.example.json" || fail "stage-input example does not validate"
validate input "$sdir/stage-input.json" "$fx/stage-input.luna.json" || fail "stage-input luna-shaped fixture does not validate"
validate input "$sdir/stage-input.json" "$fx/stage-input.broken.json" && fail "stage-input broken fixture validated (must not)"
validate output "$sdir/stage-output.json" "$fx/stage-output.example.json" || fail "stage-output example does not validate"
validate output "$sdir/stage-output.json" "$fx/stage-output.broken.json" && fail "stage-output broken fixture validated (must not)"
validate stages "$sdir/stages.json" "$packs" || fail "$packs does not validate against $sdir/stages.json"

[ "$status" = 0 ] || exit 1
echo "verify-factory: OK"
