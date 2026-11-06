---
name: playwright-qa
description: Playwright QA on Codex with preconfigured test agents and MCP; otherwise use the agent-browser driver.
---

# Playwright QA on Codex

Before provisioning or installing anything, discover the connected tools and
available Playwright planner, generator, and healer roles. Driver P requires a
Codex-configured `playwright-test` MCP server and all three roles. Claude agent
files and `.mcp.json` do not satisfy this requirement.

If any prerequisite is absent, return `fallback` to the browser-QA driver gate
and offer the bundled agent-browser driver. Do not install dependencies, create
Claude config, run `init-agents`, or invoke `mcp-merge` on this path. The bundled
Codex helper rejects those two provisioning commands before any mutation.

If all prerequisites exist, use `orc-playwright detect <repo>` to locate the
project. If no project exists, return `fallback` before creating files. For a
found project, follow `../browser-qa/SKILL.md` for target/environment gates and
`references/dispatch-prompts.md` for the planner, generator, and healer briefs.
Dispatch through Codex's agent tools with those supplied role instructions.
Read `EXECUTION.md` and follow every shared stage from planning through evidence.
It preserves target credential injection, the guarded-target exclusion of
`@mutating` tests, generated-code scanning, bounded healing, and the packet schema.
Do not run a bare suite command in place of those steps. Report actual failures;
never claim a connected MCP server or role without discovering it.

Automatic Codex agent/MCP provisioning is a documented limitation of this
release. The agent-browser driver remains available for first-time browser QA.
