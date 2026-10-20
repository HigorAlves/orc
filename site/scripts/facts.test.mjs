// Facts the site prints (counts, version) come from the repo, never from hand-typed copy.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { collectFacts, diffFacts } from "./facts.mjs"

function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), "orc-facts-"))
  const orc = join(root, "orc")
  for (const d of ["skills/tdd", "skills/grilling", "skills/code-review", "commands", "agents", "hooks/scripts", ".claude-plugin", "evals/route-ci", "evals/route-qa", "evals/results"]) mkdirSync(join(orc, d), { recursive: true })
  writeFileSync(join(orc, "skills/tdd/SKILL.md"), "x")
  writeFileSync(join(orc, "skills/grilling/SKILL.md"), "x")
  writeFileSync(join(orc, "skills/code-review/SKILL.md"), "x")
  writeFileSync(join(orc, "commands/flow.md"), "x")
  writeFileSync(join(orc, "commands/ship.md"), "x")
  writeFileSync(join(orc, "agents/orc-implementer.md"), "x")
  writeFileSync(join(orc, "hooks/scripts/pre-git-guard.sh"), "x")
  writeFileSync(join(orc, "hooks/scripts/README.txt"), "not a hook")
  writeFileSync(join(orc, ".claude-plugin/plugin.json"), JSON.stringify({ version: "9.8.7" }))
  return root
}

test("collectFacts counts surfaces on disk and reads the plugin version", () => {
  const facts = collectFacts(fixtureRepo())
  assert.deepEqual(facts, { version: "9.8.7", skills: 3, commands: 2, surfaces: 5, agents: 1, hooks: 1, evals: 2 })
})

test("diffFacts names every field that drifted and nothing else", () => {
  const disk = { version: "0.28.0", skills: 87, commands: 29, surfaces: 116, agents: 14, hooks: 10, evals: 21 }
  const committed = { ...disk, version: "0.27.0", skills: 86 }
  assert.deepEqual(diffFacts(committed, disk), ["skills: 86 → 87", "version: 0.27.0 → 0.28.0"])
  assert.deepEqual(diffFacts(disk, disk), [])
})
