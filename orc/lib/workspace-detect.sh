#!/usr/bin/env bash
# orc workspace detection helper.
#
# Usage (from a hook script or any orc bash code):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
#   eval "$(orc_detect_context)"
#
# After eval, the following variables are set in the calling shell:
#   ORC_CONTEXT         repo | workspace | loose
#   ORC_REPO_ROOT       absolute path (when context=repo)
#   ORC_WORKSPACE_ROOT  absolute path (when context=workspace)
#   ORC_WORKSPACE_NAME  basename of workspace root
#   ORC_WORKSPACE_REPOS comma-separated, sorted child repo names
#   ORC_STATE_DIR       canonical .orc state dir for the active context
#
# For JSON consumers, call orc_detect_context_json instead.
#
# Detection precedence:
#   1. cwd is inside a git repo               -> repo
#   2. cwd has >=2 immediate child git repos  -> workspace
#   3. otherwise                              -> loose
#
# Sourced-library contract: this file MUST NOT modify the caller's shell
# options (no `set -e`, no `set -u`, no `set -o pipefail`). All functions
# defend against unset vars with ${VAR:-} defaults.

orc__detect_pwd() {
  pwd -P 2>/dev/null || pwd
}

orc__is_git_repo() {
  # Returns 0 if the given dir contains a usable git work tree.
  local dir="$1"
  [ -d "$dir" ] || return 1
  git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

orc__list_child_repos() {
  # Echoes one repo name per line, sorted, for immediate child dirs of $1.
  local parent="$1"
  local child
  for child in "$parent"/*/; do
    [ -d "$child" ] || continue
    child="${child%/}"
    if orc__is_git_repo "$child"; then
      basename "$child"
    fi
  done | sort
}

orc_detect_context() {
  local cwd repo_top
  cwd="$(orc__detect_pwd)"

  # Memoize per-shell, but bust the cache if cwd has changed.
  if [ "${ORC_CONTEXT_CACHED:-0}" = "1" ] && [ "${ORC_CONTEXT_CACHED_PWD:-}" = "$cwd" ]; then
    cat <<EOF
ORC_CONTEXT=${ORC_CONTEXT:-loose}
ORC_REPO_ROOT=${ORC_REPO_ROOT:-}
ORC_WORKSPACE_ROOT=${ORC_WORKSPACE_ROOT:-}
ORC_WORKSPACE_NAME=${ORC_WORKSPACE_NAME:-}
ORC_WORKSPACE_REPOS=${ORC_WORKSPACE_REPOS:-}
ORC_STATE_DIR=${ORC_STATE_DIR:-}
ORC_CONTEXT_CACHED=1
ORC_CONTEXT_CACHED_PWD=${ORC_CONTEXT_CACHED_PWD}
EOF
    return 0
  fi

  if repo_top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"; then
    cat <<EOF
ORC_CONTEXT=repo
ORC_REPO_ROOT=${repo_top}
ORC_WORKSPACE_ROOT=
ORC_WORKSPACE_NAME=
ORC_WORKSPACE_REPOS=
ORC_STATE_DIR=${repo_top}/.orc
ORC_CONTEXT_CACHED=1
ORC_CONTEXT_CACHED_PWD=${cwd}
EOF
    return 0
  fi

  local repos
  repos="$(orc__list_child_repos "$cwd" | paste -sd, -)"
  local count
  if [ -z "$repos" ]; then
    count=0
  else
    count="$(printf '%s\n' "$repos" | tr ',' '\n' | grep -c .)"
  fi

  if [ "$count" -ge 2 ]; then
    cat <<EOF
ORC_CONTEXT=workspace
ORC_REPO_ROOT=
ORC_WORKSPACE_ROOT=${cwd}
ORC_WORKSPACE_NAME=$(basename "$cwd")
ORC_WORKSPACE_REPOS=${repos}
ORC_STATE_DIR=${cwd}/.orc
ORC_CONTEXT_CACHED=1
ORC_CONTEXT_CACHED_PWD=${cwd}
EOF
    return 0
  fi

  cat <<EOF
ORC_CONTEXT=loose
ORC_REPO_ROOT=
ORC_WORKSPACE_ROOT=
ORC_WORKSPACE_NAME=
ORC_WORKSPACE_REPOS=
ORC_STATE_DIR=
ORC_CONTEXT_CACHED=1
ORC_CONTEXT_CACHED_PWD=${cwd}
EOF
}

orc_context_banner() (
  # Canonical one-look context banner — shared by the SessionStart hook and
  # (from 0.7.0) the dynamic `!`orc-workspace-detect --banner`` injection in
  # command bodies. Subshell body: detection vars never leak to the caller.
  eval "$(orc_detect_context)"
  case "${ORC_CONTEXT:-loose}" in
    workspace)
      printf 'orc context: workspace[%s] — repos: %s — state: %s\n' \
        "${ORC_WORKSPACE_NAME}" "${ORC_WORKSPACE_REPOS}" "${ORC_STATE_DIR}"
      printf 'In workspace mode, repo-scoped commands prompt for --repos/--repo before broadcasting; pass --this-repo to scope to cwd, --all-repos to fan out.\n'
      ;;
    repo)
      branch="$(git -C "${ORC_REPO_ROOT:-.}" branch --show-current 2>/dev/null || true)"
      printf 'orc context: repo — root: %s — branch: %s — state: %s\n' \
        "${ORC_REPO_ROOT}" "${branch:-detached}" "${ORC_STATE_DIR}"
      ;;
    loose)
      printf 'orc context: loose — cwd is neither a git repo nor a workspace parent (no .orc state will be written here).\n'
      ;;
  esac
)

orc_detect_context_json() {
  # Re-evaluates fresh into a subshell so we never pollute the caller.
  local block
  block="$(orc_detect_context)"
  # shellcheck disable=SC2034
  local ORC_CONTEXT="" ORC_REPO_ROOT="" ORC_WORKSPACE_ROOT="" ORC_WORKSPACE_NAME=""
  # shellcheck disable=SC2034
  local ORC_WORKSPACE_REPOS="" ORC_STATE_DIR=""
  eval "$block"
  local repos_json="[]"
  if [ -n "${ORC_WORKSPACE_REPOS:-}" ]; then
    repos_json="$(printf '%s' "$ORC_WORKSPACE_REPOS" | awk -v RS=, 'BEGIN{printf "["} NR>1{printf ","} {gsub(/"/,"\\\""); printf "\"%s\"", $0} END{printf "]"}')"
  fi
  cat <<EOF
{
  "context": "${ORC_CONTEXT}",
  "repoRoot": "${ORC_REPO_ROOT}",
  "workspaceRoot": "${ORC_WORKSPACE_ROOT}",
  "workspaceName": "${ORC_WORKSPACE_NAME}",
  "workspaceRepos": ${repos_json},
  "stateDir": "${ORC_STATE_DIR}"
}
EOF
}
