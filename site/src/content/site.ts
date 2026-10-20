// Copy and data for the landing page. Counts and the version live in facts.json
// (generated from the repo by scripts/facts.mjs); never type them here.
import facts from "./facts.json"

export { facts }

export const REPO = "https://github.com/HigorAlves/orc"
export const doc = (path: string) => `${REPO}/blob/main/${path}`

export const nav = [
  { label: "Workflow", href: "#loop" },
  { label: "Cockpit", href: "#cockpit" },
  { label: "Commands", href: "#commands" },
  { label: "Safety", href: "#guardrails" },
  { label: "Docs", href: doc("docs/README.md") },
]

export const install = {
  cli: [
    { cmd: "curl -fsSL https://raw.githubusercontent.com/HigorAlves/orc/main/cli/install.sh | sh" },
    { cmd: "orc doctor --fix", note: "git, jq, and the recommended tools" },
    { cmd: "orc install", note: "register the marketplace, enable the plugin" },
  ],
  marketplace: [
    { cmd: "/plugin marketplace add HigorAlves/orc" },
    { cmd: "/plugin install orc@orc", note: "then run `orc doctor` for the runtime tools" },
  ],
}

export type Phase = { cmd: string; name: string; gate: boolean; summary: string; steps: string[]; artifact: string[] }

export const loop: Phase[] = [
  {
    cmd: "/orc:plan", name: "Plan", gate: true,
    summary: "A TDD-shaped plan, sliced into tracer bullets that each fit one context window.",
    steps: ["Triage the request: feature, bug or refactor.", "Draft the plan against the codebase graph.", "Slice it; each slice declares its files and acceptance criteria.", "Approve the plan at the gate."],
    artifact: [".orc/feat-PROJ-142/files/", "├── plan.md            4 slices · est 288 LOC", "├── slices.json        pending ×4", "└── decisions.json     type=feature scope=medium"],
  },
  {
    cmd: "/orc:start", name: "Start", gate: false,
    summary: "An isolated worktree and the first failing test, before any production code exists.",
    steps: ["Create a worktree off main.", "Write the slice-1 test with orc-test-author.", "Run it and watch it fail for the right reason.", "Checkpoint, so the next session starts here."],
    artifact: ["$ npm test export.test.ts", "✗ exports reports as CSV", "  expected 'text/csv'", "  received undefined          red, as planned"],
  },
  {
    cmd: "orc-implementer", name: "Implement", gate: false,
    summary: "Slices go red to green, one commit each, the full suite green between them. Parallel when the plan allows.",
    steps: ["Write the slice's failing test.", "Write the minimum code that passes it.", "Run the full suite, then lint if configured.", "Commit the slice and record it in the ledger."],
    artifact: ["slice 1  committed  a1f3c2e  feat(reports): csv serializer", "slice 2  committed  9b0e1d4  feat(reports): export endpoint", "slice 3  committed  c44a8f0  feat(reports): download button", "slice 4  committed  1e7d2b9  test(reports): empty report"],
  },
  {
    cmd: "/orc:qa", name: "QA", gate: true,
    summary: "Playwright drives a real browser against local or staging and scores every acceptance criterion with evidence.",
    steps: ["Resolve the target: local Docker or staging.", "Generate a test per acceptance criterion.", "Record one stitched video with criterion overlays.", "Write the verdict from the manifest, not from prose."],
    artifact: ["qa/", "├── qa-feat-PROJ-142.webm   5 chapters", "├── ac-1-1-export-202.png   pass", "├── network.har · console.log", "└── qa-manifest.json        5/5 criteria"],
  },
  {
    cmd: "/orc:ship", name: "Ship", gate: true,
    summary: "A terse PR body with evidence and a merge-danger line, behind one preview and a 300-line budget.",
    steps: ["Verify the suite and the branch.", "Compose the body: why, how tested, door and blast radius.", "Check the size budget; stack if over.", "Open the PR after the preview gate."],
    artifact: ["feat(reports): add CSV export", "", "## How tested", "Tests: 58 pass. QA: 5/5 criteria, staging.", "", "Door: two-way · Blast radius: reports page", "Resolves PROJ-142"],
  },
  {
    cmd: "/orc:ci", name: "CI", gate: false,
    summary: "A red check gets diagnosed and classified before anyone touches code: fixable, flake, infra, or needs debugging.",
    steps: ["Fetch the failing job's log.", "Classify each failure.", "Apply fixable items, re-run flakes once.", "Escalate infra with the evidence."],
    artifact: ["orc-ci-investigator", "  lint   fixable  unused import, reports/api.ts:4", "  e2e    flake    retry passed", "→ 1 fix committed · 4/4 green"],
  },
  {
    cmd: "/orc:release", name: "Release", gate: true,
    summary: "The bump comes from conventional commits, the notes from the changelog, behind one preview.",
    steps: ["Classify commits since the last tag.", "Preview the bump and the notes.", "Tag and push.", "Publish the GitHub release."],
    artifact: ["v1.3.0 → v1.4.0 (minor)", "  6 feat · 2 fix · 1 chore", "  CHANGELOG.md updated", "  tag pushed · release published"],
  },
]

export const situations: { group: string; items: { label: string; cmd: string }[] }[] = [
  { group: "Build", items: [
    { label: "Hand over a whole feature", cmd: "/orc:flow" }, { label: "Plan a feature or refactor", cmd: "/orc:plan" },
    { label: "Start with a worktree and a failing test", cmd: "/orc:start" }, { label: "QA a web change with evidence", cmd: "/orc:qa" },
    { label: "Open the PR", cmd: "/orc:ship" }, { label: "Split a branch that grew too big", cmd: "/orc:stack-pr" },
  ] },
  { group: "Fix", items: [
    { label: "A bug or a failing test", cmd: "/orc:debug" }, { label: "CI is red on my PR", cmd: "/orc:ci" },
    { label: "Production is down right now", cmd: "/orc:incident" },
  ] },
  { group: "Review", items: [
    { label: "Review someone else's PR", cmd: "/orc:code-review" }, { label: "Reviewers commented on my PR", cmd: "/orc:address" },
  ] },
  { group: "Plan big", items: [
    { label: "Too big for one session", cmd: "/orc:wayfinder" }, { label: "Herd the issue backlog", cmd: "/orc:triage" },
    { label: "Break a feature into Jira tickets", cmd: "/orc:jira-breakdown" },
  ] },
  { group: "Write", items: [
    { label: "A PRD, TRD, RFC or ADR", cmd: "/orc:prd" }, { label: "A blameless postmortem", cmd: "/orc:postmortem" },
  ] },
  { group: "Operate", items: [
    { label: "Audit or upgrade dependencies", cmd: "/orc:deps" }, { label: "Cut a release", cmd: "/orc:release" },
    { label: "Boot a dev environment", cmd: "/orc:env" },
  ] },
  { group: "Sessions", items: [
    { label: "Pick up where I left off", cmd: "/orc:resume" }, { label: "Look back and improve the setup", cmd: "/orc:retro" },
    { label: "Clean up merged work", cmd: "/orc:cleanup" },
  ] },
]

export const guardrails = [
  { chip: "pre-commit-branch-check.sh", title: "Off main, always", body: "A commit or push on main, master or develop stops at a confirm prompt. No env-var escape." },
  { chip: "pre-commit-no-ai-attribution.sh", title: "Your history stays yours", body: "Commits and PRs carrying Co-Authored-By: Claude or \"Generated with\" are refused outright." },
  { chip: "pre-destructive-git-check.sh", title: "Destructive git asks first", body: "reset --hard, clean -f, branch -D and force-push need a keystroke. Lease-protected pushes pass." },
  { chip: "no backend", title: "100% local", body: "No orc servers and no telemetry. Network use is GitHub for releases and the MCP servers you add." },
  { chip: "/orc:qa", title: "Evidence, not adjectives", body: "\"QA passed\" needs a packet: per-criterion screenshots, a recording, console, HAR and narrated steps." },
  { chip: "pr-size-budget", title: "PRs a human can review", body: "Over 300 lines, orc stacks the branch or asks you to record why. It never ships big silently." },
]

export const alerts = [
  { surface: "ci", chip: "AbovePrompt · CI watcher", alt: "CI red on #128: lint, e2e", body: "A linked PR turns red; the band names the failing checks. Diagnose hands it to /orc:ci. It never pushes or posts on its own.", actions: ["Diagnose", "Dismiss"] },
  { surface: "guard", chip: "AbovePrompt · destructive git", alt: "git clean would remove dist, coverage, .env.local and a fixture", body: "Before git clean, reset --hard or a force-push, the band shows exactly what would be lost, next to the confirm prompt." },
  { surface: "sentinel", chip: "AbovePrompt · sentinel", alt: "Heads up: edit to src/billing/plan.ts is outside slice 3", body: "An edit outside the slice's declared files, or a slice outgrowing its line budget, raises a heads-up while there is still time to steer." },
  { surface: "cache", chip: "AbovePrompt · cache", alt: "Cache cools in 6 minutes; re-write about 142k tokens, about $1.84", body: "A long wait on an agent is about to let the prompt cache expire. The band says what the re-write will cost before you step away." },
  { surface: "retro", chip: "AbovePrompt · retro", alt: "Retro: use pnpm, not npm, in this repo; seen twice", body: "A correction you made twice becomes a proposed rule. Save it, edit it, or skip it; /orc:retro picks up the rest.", actions: ["Save", "Skip"] },
] as const
