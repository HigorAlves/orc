#!/usr/bin/env bash
# shellcheck disable=SC2015,SC2016  # $vars inside single quotes are jq program variables
# targets.sh — the named QA-target registry (<state>/targets.json) behind
# bin/orc-targets. A target = where browser QA runs (local provisioned env or
# a remote URL), its health probe, a guard flag, named test users, and a login
# recipe. Credential VALUES are references resolved only at run time:
#   literal | op://vault/item/field (1Password CLI) | env:VAR_NAME
# Resolved JSON goes to stdout for the caller to export as ORC_TARGET_JSON —
# never to disk. Sourced after lib/state.sh (orc_state__dir).
# Sourced-library contract: never changes caller shell options.

ORC_TARGETS_SCHEMA=1

orc_targets__file() { printf '%s/targets.json\n' "$(orc_state__dir)"; }

orc_targets__write() { # $1 = jq program; rest = jq args. Atomic.
  local f prog="$1"; shift
  f="$(orc_targets__file)"
  mkdir -p "$(dirname "$f")"
  jq "$@" "$prog" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}

orc_targets_init() {
  local f; f="$(orc_targets__file)"
  [ -f "$f" ] && return 0
  mkdir -p "$(dirname "$f")"
  jq -n --argjson s "$ORC_TARGETS_SCHEMA" '{schema: $s, targets: {local: {kind: "local", baseUrl: null, healthPath: "/", guard: false, users: {}, login: null}}}' > "$f"
}

orc_targets__require() { # $1 = name → exit 1 if absent
  local f; f="$(orc_targets__file)"
  [ -f "$f" ] && jq -e --arg n "$1" '.targets[$n] != null' "$f" >/dev/null 2>&1 \
    || { echo "orc-targets: no target named '$1' (orc-targets list)" >&2; return 1; }
}

orc_targets_list() {
  orc_targets_init
  jq -r '.targets | to_entries[] | [.key, .value.kind, (.value.baseUrl // "-"), (.value.guard | tostring)] | @tsv' "$(orc_targets__file)"
}

orc_targets_get() { # <name>
  orc_targets_init; orc_targets__require "$1" || return 1
  jq --arg n "$1" '.targets[$n] + {name: $n}' "$(orc_targets__file)"
}

orc_targets_set() { # <name> [--base-url U] [--kind local|remote] [--health-path P] [--guard true|false]
  local name="${1:-}"; shift || true
  [ -n "$name" ] || { echo "orc-targets: set needs a name" >&2; return 2; }
  orc_targets_init
  local base="" kind="" health="" guard=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --base-url) base="$2"; shift 2 ;;
      --kind) kind="$2"; shift 2 ;;
      --health-path) health="$2"; shift 2 ;;
      --guard) guard="$2"; shift 2 ;;
      *) echo "orc-targets: unknown argument $1" >&2; return 2 ;;
    esac
  done
  [ -z "$kind" ] && { [ -n "$base" ] && kind="remote" || kind="local"; }
  case "$kind" in local|remote) ;; *) echo "orc-targets: kind must be local|remote" >&2; return 2 ;; esac
  case "${guard:-false}" in true|false) ;; *) echo "orc-targets: guard must be true|false" >&2; return 2 ;; esac
  orc_targets__write '
    .targets[$n] = ((.targets[$n] // {users: {}, login: null, healthPath: "/", guard: false})
      + {kind: $k}
      + (if $b != "" then {baseUrl: $b} else {} end)
      + (if $h != "" then {healthPath: $h} else {} end)
      + (if $g != "" then {guard: ($g == "true")} else {} end))' \
    --arg n "$name" --arg k "$kind" --arg b "$base" --arg h "$health" --arg g "$guard"
}

orc_targets_user() { # <target> <user> --username V --password V
  local target="${1:-}" user="${2:-}"; shift 2 || true
  orc_targets_init; orc_targets__require "$target" || return 1
  local u="" p=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --username) u="$2"; shift 2 ;;
      --password) p="$2"; shift 2 ;;
      *) echo "orc-targets: unknown argument $1" >&2; return 2 ;;
    esac
  done
  [ -n "$u" ] && [ -n "$p" ] || { echo "orc-targets: user needs --username and --password (literal | op://… | env:VAR)" >&2; return 2; }
  orc_targets__write '.targets[$t].users[$u] = {username: $un, password: $pw}' \
    --arg t "$target" --arg u "$user" --arg un "$u" --arg pw "$p"
}

orc_targets_login() { # <target> --path P --username-field F --password-field F --submit TEXT --success-path P
  local target="${1:-}"; shift || true
  orc_targets_init; orc_targets__require "$target" || return 1
  local path="/login" uf="Email" pf="Password" submit="Sign in" ok="/"
  while [ $# -gt 0 ]; do
    case "$1" in
      --path) path="$2"; shift 2 ;;
      --username-field) uf="$2"; shift 2 ;;
      --password-field) pf="$2"; shift 2 ;;
      --submit) submit="$2"; shift 2 ;;
      --success-path) ok="$2"; shift 2 ;;
      *) echo "orc-targets: unknown argument $1" >&2; return 2 ;;
    esac
  done
  orc_targets__write '.targets[$t].login = {path: $p, usernameField: $uf, passwordField: $pf, submit: $s, successPath: $ok}' \
    --arg t "$target" --arg p "$path" --arg uf "$uf" --arg pf "$pf" --arg s "$submit" --arg ok "$ok"
}

orc_targets__resolve_value() { # $1 = reference → value on stdout; exit 3 when unresolvable
  local v="$1" op="${ORC_TARGETS_OP_BIN:-op}"
  case "$v" in
    op://*)
      command -v "$op" >/dev/null 2>&1 || { echo "orc-targets: 1Password CLI ($op) not found — needed to read $v" >&2; return 3; }
      "$op" read "$v" 2>/dev/null || { echo "orc-targets: '$op read $v' failed — run: op signin" >&2; return 3; } ;;
    env:*)
      local n="${v#env:}"
      printf '%s' "$n" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' || { echo "orc-targets: invalid env reference '$v' (expected env:VAR_NAME)" >&2; return 3; }
      [ -n "${!n:-}" ] || { echo "orc-targets: env var $n is empty — referenced by a target credential" >&2; return 3; }
      printf '%s' "${!n}" ;;
    *) printf '%s' "$v" ;;
  esac
}

orc_targets_resolve() { # <name> [--base-url U] → resolved JSON on stdout (never written to disk)
  local name="${1:-}"; shift || true
  local override=""
  while [ $# -gt 0 ]; do
    case "$1" in --base-url) override="$2"; shift 2 ;; *) echo "orc-targets: unknown argument $1" >&2; return 2 ;; esac
  done
  local json; json="$(orc_targets_get "$name")" || return 1
  # An ad-hoc URL that leaves localhost is an UNAUTHENTICATED remote run: the local target's users/login never
  # travel to an arbitrary origin. Authenticated remote QA needs a named target (orc-targets set/user/login).
  [ -n "$override" ] && json="$(printf '%s' "$json" | jq --arg b "$override" '
    ($b | test("^https?://(localhost|127\\.0\\.0\\.1)(:|/|$)")) as $isLocal
    | .baseUrl = $b
    | if .kind == "local" and ($isLocal | not) then .kind = "remote" | .users = {} | .login = null | .adhoc = true else . end')"
  local user un pw run rpw
  while IFS= read -r user; do
    [ -n "$user" ] || continue
    un="$(printf '%s' "$json" | jq -r --arg u "$user" '.users[$u].username')"
    pw="$(printf '%s' "$json" | jq -r --arg u "$user" '.users[$u].password')"
    run="$(orc_targets__resolve_value "$un")" || return 3
    rpw="$(orc_targets__resolve_value "$pw")" || return 3
    json="$(printf '%s' "$json" | jq --arg u "$user" --arg un "$run" --arg pw "$rpw" '.users[$u] = {username: $un, password: $pw}')"
  done < <(printf '%s' "$json" | jq -r '.users | keys[]')
  printf '%s\n' "$json"
}

orc_targets_probe() { # <name|url> → exit 0 when GET baseUrl+healthPath is 2xx/3xx
  local arg="${1:-}" url
  case "$arg" in
    http://*|https://*) url="$arg" ;;
    *) url="$(orc_targets_get "$arg" | jq -r '(.baseUrl // "") + (.healthPath // "/")')" || return 1 ;;
  esac
  [ -n "$url" ] && [ "$url" != "/" ] || { echo "orc-targets: target has no baseUrl to probe" >&2; return 1; }
  curl -sf -o /dev/null --max-time 10 -L "$url"
}

# CLI mode — active only when EXECUTED (via bin/orc-targets), never when sourced.
if [ "${BASH_SOURCE[0]:-}" = "${0:-}" ]; then
  set -euo pipefail
  # shellcheck disable=SC1091
  . "$(dirname "${BASH_SOURCE[0]}")/state.sh"
  sub="${1:-}"; shift 2>/dev/null || true
  case "$sub" in
    init)    orc_targets_init ;;
    list)    orc_targets_list ;;
    get)     orc_targets_get "$@" ;;
    set)     orc_targets_set "$@" ;;
    user)    orc_targets_user "$@" ;;
    login)   orc_targets_login "$@" ;;
    resolve) orc_targets_resolve "$@" ;;
    probe)   orc_targets_probe "$@" ;;
    --help|-h|help|'') printf 'usage: orc-targets init|list|get <n>|set <n> [--base-url U --kind K --health-path P --guard B]|user <t> <u> --username V --password V|login <t> [--path --username-field --password-field --submit --success-path]|resolve <n> [--base-url U]|probe <n|url>\n' ;;
    *) printf 'orc-targets: unknown subcommand %s\n' "$sub" >&2; exit 2 ;;
  esac
fi
