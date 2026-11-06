#!/usr/bin/env bash
# playwright-env.sh — detect/scaffold the committed Playwright project Driver P
# runs, install it, run Playwright's init-agents, and merge the playwright-test
# MCP server into .mcp.json without clobbering. Behind bin/orc-playwright.
# Sourced-library contract: never changes caller shell options.

ORC_PW_DEFAULT_DIR="e2e"

orc_pw__backup() { # <repo_root> <file> → copies to <state>/backups/<name>.<ts>, prints the path (never the repo root: .mcp.json may hold tokens)
  local root="$1" f="$2" dir out
  dir="$root/.orc/backups"   # the target repo's own gitignored .orc/, never the caller's state dir
  mkdir -p "$dir"
  out="$dir/$(basename "$f").$(date -u +%Y%m%dT%H%M%SZ)"
  cp "$f" "$out" && printf '%s\n' "$out"
}

orc_pw__tmpl_dir() { printf '%s/playwright\n' "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; }

orc_pw_detect() { # <repo_root> → "<dir>\t<config>" | exit 1
  local root="${1:-.}" c
  for c in playwright.config.ts playwright.config.mts playwright.config.js playwright.config.mjs; do
    [ -f "$root/$c" ] && { printf '.\t%s\n' "$c"; return 0; }
  done
  for c in playwright.config.ts playwright.config.mts playwright.config.js playwright.config.mjs; do
    [ -f "$root/$ORC_PW_DEFAULT_DIR/$c" ] && { printf '%s\t%s/%s\n' "$ORC_PW_DEFAULT_DIR" "$ORC_PW_DEFAULT_DIR" "$c"; return 0; }
  done
  return 1
}

orc_pw__put() { # <dest> <template-name> <rel> → prints "created <rel>" | "kept <rel>"
  local dest="$1" tmpl="$2" rel="$3"
  if [ -e "$dest" ]; then printf 'kept %s\n' "$rel"; return 0; fi
  mkdir -p "$(dirname "$dest")"
  cp "$(orc_pw__tmpl_dir)/$tmpl" "$dest"
  printf 'created %s\n' "$rel"
}

orc_pw_scaffold() { # <repo_root> [--dir e2e]
  local root="${1:-.}" dir="$ORC_PW_DEFAULT_DIR"; shift || true
  while [ $# -gt 0 ]; do case "$1" in --dir) dir="$2"; shift 2 ;; *) echo "orc-playwright: unknown argument $1" >&2; return 2 ;; esac; done
  orc_pw__put "$root/$dir/package.json"          package.json.tmpl          "$dir/package.json"
  orc_pw__put "$root/$dir/playwright.config.ts"  playwright.config.ts.tmpl  "$dir/playwright.config.ts"
  orc_pw__put "$root/$dir/tests/fixtures.ts"     fixtures.ts.tmpl           "$dir/tests/fixtures.ts"
  orc_pw__put "$root/$dir/tests/auth.setup.ts"   auth.setup.ts.tmpl         "$dir/tests/auth.setup.ts"
  orc_pw__put "$root/$dir/tests/seed.spec.ts"    seed.spec.ts.tmpl          "$dir/tests/seed.spec.ts"
  orc_pw__put "$root/$dir/.gitignore"            gitignore.tmpl             "$dir/.gitignore"
  orc_pw__put "$root/$dir/specs/README.md"       specs-README.md.tmpl       "$dir/specs/README.md"
}

orc_pw_install() { # <repo_root> --dir D  (runs ONLY after the caller's setup gate)
  local root="${1:-.}" dir="$ORC_PW_DEFAULT_DIR"; shift || true
  while [ $# -gt 0 ]; do case "$1" in --dir) dir="$2"; shift 2 ;; *) return 2 ;; esac; done
  (cd "$root/$dir" && npm install --no-fund --no-audit && npx playwright install chromium)
}

orc_pw_init_agents() { # <repo_root> --dir D --config C  (runs from repo root so .claude/agents lands there)
  local root="${1:-.}" dir="$ORC_PW_DEFAULT_DIR" cfg=""; shift || true
  while [ $# -gt 0 ]; do case "$1" in --dir) dir="$2"; shift 2 ;; --config) cfg="$2"; shift 2 ;; *) return 2 ;; esac; done
  [ -n "$cfg" ] || { echo "orc-playwright: init-agents needs --config" >&2; return 2; }
  local bak=""
  if [ -f "$root/.mcp.json" ]; then bak="$(orc_pw__backup "$root" "$root/.mcp.json")"; fi
  (cd "$root" && node "$dir/node_modules/playwright/cli.js" init-agents --loop=claude -c "$cfg")
  # init-agents overwrote .mcp.json unconditionally; restore the user's servers then add ours.
  if [ -n "$bak" ]; then cp "$bak" "$root/.mcp.json"; fi
  orc_pw_mcp_merge "$root" --dir "$dir" --config "$cfg"
}

orc_pw_mcp_merge() { # <repo_root> --dir D --config C
  local root="${1:-.}" dir="$ORC_PW_DEFAULT_DIR" cfg=""; shift || true
  while [ $# -gt 0 ]; do case "$1" in --dir) dir="$2"; shift 2 ;; --config) cfg="$2"; shift 2 ;; *) return 2 ;; esac; done
  [ -n "$cfg" ] || { echo "orc-playwright: mcp-merge needs --config" >&2; return 2; }
  local f="$root/.mcp.json" cli
  case "$dir" in .|"") cli="node_modules/playwright/cli.js" ;; *) cli="$dir/node_modules/playwright/cli.js" ;; esac
  if [ -f "$f" ]; then
    orc_pw__backup "$root" "$f" >/dev/null
  else
    printf '{"mcpServers":{}}\n' > "$f"
  fi
  jq --arg cli "$cli" --arg cfg "$cfg" '.mcpServers["playwright-test"] = {command: "node", args: [$cli, "run-test-mcp-server", "-c", $cfg]}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  printf '%s\n' "$f"
}

# CLI mode — active only when EXECUTED (via bin/orc-playwright), never when sourced.
if [ "${BASH_SOURCE[0]:-}" = "${0:-}" ]; then
  set -euo pipefail
  sub="${1:-}"; shift 2>/dev/null || true
  case "$sub" in
    detect)      orc_pw_detect "$@" ;;
    scaffold)    orc_pw_scaffold "$@" ;;
    install)     orc_pw_install "$@" ;;
    init-agents) orc_pw_init_agents "$@" ;;
    mcp-merge)   orc_pw_mcp_merge "$@" ;;
    --help|-h|help|'') printf 'usage: orc-playwright detect <root>|scaffold <root> [--dir D]|install <root> --dir D|init-agents <root> --dir D --config C|mcp-merge <root> --dir D --config C\n' ;;
    *) printf 'orc-playwright: unknown subcommand %s\n' "$sub" >&2; exit 2 ;;
  esac
fi
