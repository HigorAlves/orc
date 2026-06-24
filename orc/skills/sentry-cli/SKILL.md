---
name: sentry-cli
version: 0.30.0
description: Guide for using the Sentry CLI from the command line. Use when viewing issues, events, projects, traces, dashboards, releases, making API calls, or authenticating with Sentry via CLI.
requires:
  bins: ["sentry"]
  auth: true
---

# Sentry CLI Usage Guide

Help users interact with Sentry from the command line using the `sentry` CLI. This SKILL.md is a thin index — **Read the relevant `references/*.md` file when you need that detail.**

## When to use

Reach for this skill whenever the user wants to investigate or manage Sentry from the terminal: viewing/triaging issues and events, exploring traces, spans, and logs, building dashboards, managing releases and deploys, making authenticated API calls, or authenticating the CLI.

## How to work

1. **Just run the command** — the CLI auto-handles auth and org/project detection. Don't pre-authenticate or look up org/project first.
2. **Prefer dedicated CLI commands** over raw `sentry api` calls or fetching external docs.
3. **Use `--json`** for machine-readable output; pipe through `jq`.
4. **Read `references/agent-guidance.md` first** for the operational best-practices, exit codes, workflow patterns, quick reference, and common mistakes — it is the most important file for agents.

## Decision tree

- New to the CLI / need to install or authenticate → `references/setup.md`, `references/auth.md`
- Operating as an agent (principles, exit codes, workflows, gotchas) → `references/agent-guidance.md`
- Investigating an error/issue → `references/issue.md`, `references/event.md`
- Performance / distributed tracing → `references/trace.md`, `references/span.md`, `references/explore.md`
- Logs → `references/log.md`
- Dashboards & widgets (incl. 6-column grid layout) → `references/dashboard.md`
- Releases, deploys, commits → `references/release.md`, `references/sourcemap.md`
- Org / project / team / repo management → `references/org.md`, `references/project.md`, `references/team.md`, `references/repo.md`
- Raw API access / schema discovery → `references/api.md`, `references/schema.md`
- Trials, CLI maintenance, project init → `references/trial.md`, `references/cli.md`, `references/init.md`

## Topic index

| Topic | What's there | Reference |
|---|---|---|
| Agent guidance | Key/design principles, context tips, safety rules, exit codes, workflow patterns, quick reference, common mistakes | `references/agent-guidance.md` |
| Setup | Install, authenticate, global options, output formats (`--json`, `--web`) | `references/setup.md` |
| Auth | `sentry auth login/logout/refresh/status/token/whoami` | `references/auth.md` |
| Org | `sentry org list/view` | `references/org.md` |
| Project | `sentry project create/delete/list/view` | `references/project.md` |
| Team | `sentry team list` | `references/team.md` |
| Repo | `sentry repo list` | `references/repo.md` |
| Issue | `sentry issue list/events/explain/plan/view/resolve/unresolve/merge` | `references/issue.md` |
| Event | `sentry event view/list` | `references/event.md` |
| Trace | `sentry trace list/view/logs` | `references/trace.md` |
| Span | `sentry span list/view` | `references/span.md` |
| Explore | `sentry explore` (aggregate event data) | `references/explore.md` |
| Log | `sentry log list/view` (incl. `--follow`) | `references/log.md` |
| Dashboard | `sentry dashboard list/view/create`, `widget add/edit/delete`, 6-column grid layout | `references/dashboard.md` |
| Release | `sentry release list/view/create/finalize/delete/deploy/deploys/set-commits/propose-version` | `references/release.md` |
| Sourcemap | `sentry sourcemap inject/upload` | `references/sourcemap.md` |
| API | `sentry api <endpoint>` (curl-like authenticated requests) | `references/api.md` |
| Schema | `sentry schema <resource...>` (browse the API schema) | `references/schema.md` |
| Trial | `sentry trial list/start` | `references/trial.md` |
| CLI | `sentry cli defaults/feedback/fix/setup/upgrade` | `references/cli.md` |
| Init | `sentry init` (experimental project setup) | `references/init.md` |

Each command reference lists full flags and runnable examples. All commands also support `--json`, `--fields`, `--help`, `--log-level`, and `--verbose`.
