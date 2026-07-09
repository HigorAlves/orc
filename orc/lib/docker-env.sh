#!/usr/bin/env bash
# orc docker-env helper — shared plumbing for the env-provisioning skill,
# the orc-env-provisioner agent, /orc:env, /orc:qa, and /orc:cleanup.
#
# Usage (sourced):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/docker-env.sh"
#   project=$(orc_env_project_name "myapp" "feat/csv-export")
#
# Usage (executed, via bin/orc-docker-env on PATH):
#   orc-docker-env probe
#   orc-docker-env project-name <name> <branch>
#   orc-docker-env is-ready <state-file>
#   orc-docker-env orphans [known-project ...]
#   orc-docker-env teardown-preview <state-file>
#
# Sourced-library contract: this file MUST NOT modify the caller's shell
# options (no `set -e`, no `set -u`, no `set -o pipefail`). All functions
# defend against unset vars with ${VAR:-} defaults.

orc_env_project_name() {
  # Compose project name: orc-<name>-<sanitized-branch>, lowercase,
  # [a-z0-9_-] only, <= 63 chars. Stable across re-runs on the same branch —
  # this is the reuse key for containers, volumes, networks, and orphan sweeps.
  local name="${1:-}" branch="${2:-}"
  printf 'orc-%s-%s' "$name" "$branch" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -e 's/[^a-z0-9_-]/-/g' -e 's/-\{2,\}/-/g' -e 's/^-//' -e 's/-$//' \
    | cut -c1-63
}

orc_env_state_path() {
  # Canonical docker-env-state.json path for the given state dir + sanitized
  # branch. Defaults: $ORC_STATE_DIR (from workspace-detect) + current branch.
  local state_dir="${1:-${ORC_STATE_DIR:-}}"
  local branch="${2:-}"
  if [ -z "$branch" ]; then
    branch="$(git branch --show-current 2>/dev/null | tr '/' '-')"
  fi
  [ -n "$state_dir" ] && [ -n "$branch" ] || return 1
  printf '%s/%s/files/docker-env-state.json' "$state_dir" "$branch"
}

orc_env_probe_docker() {
  # Echoes exactly one of: ok | no-docker | no-daemon | no-compose.
  # Never exits non-zero — callers branch on the echoed word.
  if ! command -v docker >/dev/null 2>&1; then
    printf 'no-docker\n'; return 0
  fi
  if ! docker info >/dev/null 2>&1; then
    printf 'no-daemon\n'; return 0
  fi
  if ! docker compose version >/dev/null 2>&1; then
    printf 'no-compose\n'; return 0
  fi
  printf 'ok\n'
}

orc_env_is_ready() {
  # The single reuse check qa/flow/env all call. Ready means:
  #   state file exists AND status==ready AND every recorded service is
  #   running per `docker compose ps` AND (when set) appUrl answers curl.
  # Echoes ready|stale|absent; returns 0 only for ready.
  local state_file="${1:-}"
  if [ -z "$state_file" ] || [ ! -f "$state_file" ]; then
    printf 'absent\n'; return 1
  fi
  command -v jq >/dev/null 2>&1 || { printf 'stale\n'; return 1; }

  local status project expected running app_url
  status="$(jq -r '.status // empty' "$state_file" 2>/dev/null)"
  project="$(jq -r '.project // empty' "$state_file" 2>/dev/null)"
  if [ "$status" != "ready" ] || [ -z "$project" ]; then
    printf 'stale\n'; return 1
  fi

  expected="$(jq -r '.services | length' "$state_file" 2>/dev/null)"
  running="$(docker compose -p "$project" ps --format json 2>/dev/null \
    | jq -s 'flatten | map(select((.State // .state // "") == "running")) | length' 2>/dev/null)"
  if [ -z "$running" ] || [ "${running:-0}" -lt "${expected:-1}" ]; then
    printf 'stale\n'; return 1
  fi

  app_url="$(jq -r '.appUrl // empty' "$state_file" 2>/dev/null)"
  if [ -n "$app_url" ] && ! curl -sf -o /dev/null --max-time 5 "$app_url" 2>/dev/null; then
    printf 'stale\n'; return 1
  fi

  printf 'ready\n'
}

orc_env_orphans() {
  # Lists orc-* compose projects NOT in the known-project args — candidates
  # for the cleanup preview. Never removes anything itself.
  local known=" $* "
  docker compose ls --format json 2>/dev/null \
    | jq -r '.[]?.Name // empty' 2>/dev/null \
    | while IFS= read -r p; do
        case "$p" in
          orc-*)
            case "$known" in
              *" $p "*) ;;                # registered — not an orphan
              *) printf '%s\n' "$p" ;;
            esac
            ;;
        esac
      done
}

orc_env_teardown_preview() {
  # Emits the cleanup-preview lines for a state file: the teardown command,
  # the volume policy, and each service's container. Read-only.
  local state_file="${1:-}"
  [ -f "$state_file" ] && command -v jq >/dev/null 2>&1 || return 1
  jq -r '
    "project: \(.project // "?")",
    "teardown: \(.teardownCommand // "docker compose -p \(.project) down")",
    "volumes kept on down: \(.keepVolumesOnDown // true) — pass --down-volumes to remove: \((.volumes // []) | join(", "))",
    ((.services // {}) | to_entries[] | "  service \(.key): \(.value.container // "?") (\(.value.status // "?"))"),
    ((.hostProcesses // [])[] | "  host process: pid \(.pid // "?") — \(.command // "?") (port \(.port // "?"))")
  ' "$state_file" 2>/dev/null
}

# CLI mode — active only when this file is EXECUTED (via bin/orc-docker-env,
# which is on PATH while the plugin is enabled), never when sourced.
if [ "${BASH_SOURCE[0]:-}" = "${0:-}" ]; then
  sub="${1:-}"
  shift 2>/dev/null || true
  case "$sub" in
    probe)             orc_env_probe_docker ;;
    project-name)      orc_env_project_name "$@" ;;
    state-path)        orc_env_state_path "$@" ;;
    is-ready)          orc_env_is_ready "$@" ;;
    orphans)           orc_env_orphans "$@" ;;
    teardown-preview)  orc_env_teardown_preview "$@" ;;
    --help|-h|help|'') printf 'usage: orc-docker-env probe|project-name|state-path|is-ready|orphans|teardown-preview [args]\n' ;;
    *)                 printf 'orc-docker-env: unknown subcommand %s\n' "$sub" >&2; exit 2 ;;
  esac
fi
