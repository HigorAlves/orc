// Writes src/content/facts.json from the orc plugin on disk, so the site never
// prints a count or a version that the repo does not have.
//   node scripts/facts.mjs           regenerate
//   node scripts/facts.mjs --check   exit 1 when the committed file has drifted (CI)
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, "../src/content/facts.json")

const dirs = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [])
const files = (p, ext) => (existsSync(p) ? readdirSync(p).filter((f) => f.endsWith(ext)) : [])

export function collectFacts(repoRoot) {
  const orc = join(repoRoot, "orc")
  const skills = dirs(join(orc, "skills")).filter((d) => existsSync(join(orc, "skills", d, "SKILL.md"))).length
  const commands = files(join(orc, "commands"), ".md").length
  return {
    version: JSON.parse(readFileSync(join(orc, ".claude-plugin/plugin.json"), "utf8")).version,
    skills,
    commands,
    surfaces: skills + commands,
    agents: files(join(orc, "agents"), ".md").length,
    hooks: files(join(orc, "hooks/scripts"), ".sh").length,
    evals: dirs(join(orc, "evals")).filter((d) => d !== "results").length,
  }
}

export function diffFacts(committed, disk) {
  return Object.keys(disk)
    .filter((k) => committed?.[k] !== disk[k])
    .sort()
    .map((k) => `${k}: ${committed?.[k]} → ${disk[k]}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const disk = collectFacts(join(here, "../.."))
  if (process.argv.includes("--check")) {
    const committed = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null
    const drift = diffFacts(committed, disk)
    if (drift.length) {
      console.error(`facts: src/content/facts.json is stale (run pnpm facts):\n  ${drift.join("\n  ")}`)
      process.exit(1)
    }
    console.log("facts: OK")
  } else {
    writeFileSync(OUT, JSON.stringify(disk, null, 2) + "\n")
    console.log("facts:", JSON.stringify(disk))
  }
}
