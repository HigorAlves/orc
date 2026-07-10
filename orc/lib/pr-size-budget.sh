#!/usr/bin/env bash
# orc PR size budget helper.
#
# Usage (from any orc bash code):
#   . "${CLAUDE_PLUGIN_ROOT}/lib/pr-size-budget.sh"
#   loc=$(orc_pr_loc "$base")                   # net additions+deletions, post-exclusion
#   orc_pr_loc_breakdown "$base"                # markdown table of top contributors
#   budget=$(orc_pr_budget "$repo_root")        # resolved budget (CLI > env > .orc/pr-budget.json > 300)
#
# Defines:
#   ORC_PR_LOC_DEFAULT_BUDGET   integer (default 300)
#   ORC_PR_LOC_EXCLUDES         array of git pathspecs (lockfiles, generated, snapshots, builds)
#
# Sourced-library contract: this file MUST NOT modify the caller's shell options
# (no `set -e`, no `set -u`, no `set -o pipefail`). All functions defend against
# unset vars with ${VAR:-} defaults.
#
# Per-repo override file: <repo_root>/.orc/pr-budget.json
#   {
#     "budget": 300,
#     "exclude_migrations": true,
#     "additional_excludes": ["**/vendor/**", "docs/api-reference/**"]
#   }

ORC_PR_LOC_DEFAULT_BUDGET=300

# Default exclusion globs. Lockfiles, build outputs, snapshots, generated code.
# Migrations are appended below conditionally based on the per-repo override.
ORC_PR_LOC_EXCLUDES=(
  ':(exclude,glob)**/*.lock'
  ':(exclude,glob)**/*.lockb'
  ':(exclude)package-lock.json'
  ':(exclude)pnpm-lock.yaml'
  ':(exclude)yarn.lock'
  ':(exclude)Cargo.lock'
  ':(exclude)go.sum'
  ':(exclude)Gemfile.lock'
  ':(exclude)composer.lock'
  ':(exclude)poetry.lock'
  ':(exclude)uv.lock'
  ':(exclude,glob)**/__snapshots__/**'
  ':(exclude,glob)**/__generated__/**'
  ':(exclude,glob)**/generated/**'
  ':(exclude,glob)**/*.gen.ts'
  ':(exclude,glob)**/*.gen.go'
  ':(exclude,glob)**/*.pb.go'
  ':(exclude,glob)**/*.pb.ts'
  ':(exclude,glob)**/*_pb2.py'
  ':(exclude,glob)**/dist/**'
  ':(exclude,glob)**/build/**'
  ':(exclude,glob)**/.next/**'
)

orc__default_base() {
  # Best-guess base ref. Caller can override by passing $1.
  local head
  head=$(git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null | sed 's@^origin/@@')
  [ -n "$head" ] && { printf '%s' "origin/$head"; return 0; }
  # Fallback: try main, master.
  for cand in main master; do
    if git rev-parse --verify "origin/$cand" >/dev/null 2>&1; then
      printf '%s' "origin/$cand"; return 0
    fi
  done
  printf '%s' "HEAD~1"
}

orc__repo_budget_file() {
  local repo_root="${1:-$(git rev-parse --show-toplevel 2>/dev/null)}"
  [ -n "$repo_root" ] && printf '%s/.orc/pr-budget.json' "$repo_root"
}

orc_pr_budget() {
  # Resolution order: $1 (override) > $ORC_PR_LOC_BUDGET > .orc/pr-budget.json#budget
  # > userConfig pr_size_budget (CLAUDE_PLUGIN_OPTION_PR_SIZE_BUDGET) > default.
  # Per-repo intent (config file) deliberately beats the per-user default.
  local override="${1:-}"
  if [ -n "$override" ]; then printf '%s' "$override"; return 0; fi
  if [ -n "${ORC_PR_LOC_BUDGET:-}" ]; then printf '%s' "$ORC_PR_LOC_BUDGET"; return 0; fi
  local cfg
  cfg=$(orc__repo_budget_file)
  if [ -n "$cfg" ] && [ -f "$cfg" ] && command -v jq >/dev/null 2>&1; then
    local v
    v=$(jq -r '.budget // empty' "$cfg" 2>/dev/null)
    if [ -n "$v" ] && [ "$v" != "null" ]; then printf '%s' "$v"; return 0; fi
  fi
  if [ -n "${CLAUDE_PLUGIN_OPTION_PR_SIZE_BUDGET:-}" ]; then
    printf '%s' "$CLAUDE_PLUGIN_OPTION_PR_SIZE_BUDGET"; return 0
  fi
  printf '%s' "$ORC_PR_LOC_DEFAULT_BUDGET"
}

orc__build_excludes() {
  # Echo the exclusion pathspecs (one per line) for the given repo root.
  # Reads .orc/pr-budget.json for `exclude_migrations` (default true) and `additional_excludes`.
  local repo_root="${1:-$(git rev-parse --show-toplevel 2>/dev/null)}"
  local cfg
  cfg=$(orc__repo_budget_file "$repo_root")
  local exclude_migrations="true"
  local extras=()

  if [ -n "$cfg" ] && [ -f "$cfg" ] && command -v jq >/dev/null 2>&1; then
    local em
    em=$(jq -r '.exclude_migrations // true' "$cfg" 2>/dev/null)
    [ -n "$em" ] && [ "$em" != "null" ] && exclude_migrations="$em"
    while IFS= read -r line; do
      [ -n "$line" ] && extras+=(":(exclude,glob)$line")
    done < <(jq -r '(.additional_excludes // [])[]' "$cfg" 2>/dev/null)
  fi

  local pathspec
  for pathspec in "${ORC_PR_LOC_EXCLUDES[@]}"; do
    printf '%s\n' "$pathspec"
  done

  if [ "$exclude_migrations" = "true" ]; then
    printf '%s\n' ':(exclude,glob)**/migrations/**/*.sql'
    printf '%s\n' ':(exclude,glob)prisma/migrations/**'
    printf '%s\n' ':(exclude,glob)db/migrate/**'
  fi

  for pathspec in "${extras[@]}"; do
    printf '%s\n' "$pathspec"
  done
}

orc__diff_args() {
  # Build the `git diff` argument list (base + pathspecs) on stdout, NUL-separated.
  local base="$1"
  local repo_root="${2:-$(git rev-parse --show-toplevel 2>/dev/null)}"
  printf '%s\0' "${base}...HEAD"
  printf -- '--\0'
  printf '%s\0' '.'
  while IFS= read -r ex; do
    [ -n "$ex" ] && printf '%s\0' "$ex"
  done < <(orc__build_excludes "$repo_root")
}

orc_pr_loc() {
  # Net additions+deletions for $base..HEAD, post-exclusion.
  local base="${1:-$(orc__default_base)}"
  local repo_root="${2:-$(git rev-parse --show-toplevel 2>/dev/null)}"
  local args=()
  while IFS= read -r -d '' arg; do
    args+=("$arg")
  done < <(orc__diff_args "$base" "$repo_root")
  git diff --shortstat "${args[@]}" 2>/dev/null \
    | awk '{ for (i=1;i<=NF;i++) if ($i ~ /insert|delet/) sum += $(i-1) } END {print sum+0}'
}

orc_pr_loc_breakdown() {
  # Markdown table of per-file contributors (sorted desc by additions+deletions),
  # post-exclusion. Caps at 10 rows; appends a "(+ N more files)" line if truncated.
  local base="${1:-$(orc__default_base)}"
  local repo_root="${2:-$(git rev-parse --show-toplevel 2>/dev/null)}"
  local args=()
  while IFS= read -r -d '' arg; do
    args+=("$arg")
  done < <(orc__diff_args "$base" "$repo_root")

  local raw
  raw=$(git diff --numstat "${args[@]}" 2>/dev/null \
        | awk 'NF==3 { add=$1; del=$2; if (add=="-") add=0; if (del=="-") del=0; printf "%d\t%d\t%s\n", add+del, add, $3 }' \
        | sort -k1,1 -nr)
  [ -z "$raw" ] && { printf '_(no countable changes)_\n'; return 0; }

  printf '| File | +%s | -%s | Total |\n' "additions" "deletions"
  printf '|------|-----|-----|-------|\n'
  local count=0 total_files
  total_files=$(printf '%s\n' "$raw" | wc -l | tr -d ' ')
  while IFS=$'\t' read -r total add file; do
    count=$((count+1))
    [ "$count" -gt 10 ] && break
    local del=$((total - add))
    printf '| `%s` | %d | %d | %d |\n' "$file" "$add" "$del" "$total"
  done <<< "$raw"
  if [ "$total_files" -gt 10 ]; then
    printf '\n_(+ %d more files not shown)_\n' "$((total_files - 10))"
  fi
}

orc_pr_excluded_summary() {
  # Returns a one-line summary of what got excluded: count of files and total LOC.
  # Useful for the gate prompt so the user can see what was discounted.
  local base="${1:-$(orc__default_base)}"
  local repo_root="${2:-$(git rev-parse --show-toplevel 2>/dev/null)}"

  local total_files total_loc included_files included_loc
  read -r total_files total_loc < <(
    git diff --numstat "${base}...HEAD" -- . 2>/dev/null \
      | awk 'NF==3 { add=$1; del=$2; if (add=="-") add=0; if (del=="-") del=0;
                     files++; sum += add+del }
             END   { printf "%d %d\n", files+0, sum+0 }'
  )
  local args=()
  while IFS= read -r -d '' arg; do
    args+=("$arg")
  done < <(orc__diff_args "$base" "$repo_root")
  read -r included_files included_loc < <(
    git diff --numstat "${args[@]}" 2>/dev/null \
      | awk 'NF==3 { add=$1; del=$2; if (add=="-") add=0; if (del=="-") del=0;
                     files++; sum += add+del }
             END   { printf "%d %d\n", files+0, sum+0 }'
  )

  local excl_files=$((total_files - included_files))
  local excl_loc=$((total_loc - included_loc))
  printf 'Excluded: %d files (%d LOC) — lockfiles, generated, snapshots, builds, migrations.\n' \
         "$excl_files" "$excl_loc"
}
