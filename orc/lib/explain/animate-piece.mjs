// animate-piece.mjs <segments.json> <workDir> <animateSkillRoot>
// For each kind:"graphic" segment writes <workDir>/pieces/<id>/ by copying the pinned example
// piece (see animate.lock) and applying what animate's format can express as data:
//   piece.json  name=id, title=segment title, style=doc.style
//   brief.md    headline (title), beat lines (lines[]), narration — the brief an animate scene author works from
//   voice/script.json  { lead, tail, lines:[{id,text,after}] } — animate's documented voice-script shape (narration text only;
//                      orc narrates via kokoro in `orc-explain narrate`, animate's voice tool is NOT run)
// Pinned-source facts: piece.json carries no beat/headline fields; visible content is canvas JS in src/scenes.js, so
// headline/lines cannot be substituted as data. Update with animate.lock on every bump.
// Prints one JSON line per piece: {id, pieceDir}.
import fs from 'node:fs'; import path from 'node:path';
const [, , segmentsPath, workDir, skillRoot] = process.argv;
if (!segmentsPath || !workDir || !skillRoot) { console.error('usage: animate-piece.mjs <segments.json> <workDir> <animateSkillRoot>'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(segmentsPath, 'utf8'));
const example = path.join(skillRoot, 'examples', 'history-of-ai');
const style = process.argv[5] || doc.style || 'isometric';
for (const s of doc.segments.filter((x) => x.kind === 'graphic')) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(s.id))) { console.error(`animate-piece: bad segment id ${s.id}`); process.exit(2); }
  const dir = path.join(workDir, 'pieces', s.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(example, dir, { recursive: true });
  const pj = path.join(dir, 'piece.json');
  const meta = JSON.parse(fs.readFileSync(pj, 'utf8'));
  Object.assign(meta, { name: s.id, title: s.title, style });
  fs.writeFileSync(pj, JSON.stringify(meta, null, 2) + '\n');
  const lines = (s.lines || []).map((l) => `- ${l}`).join('\n');
  fs.writeFileSync(path.join(dir, 'brief.md'), `# Brief: ${s.title}\n\nStyle: ${style}. Format: 16:9.\n\n## Beat lines\n\n${lines}\n\n## Narration\n\n${s.narration}\n`);
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'voice', 'script.json'), JSON.stringify({ lead: 1.2, tail: 1.8, lines: [{ id: s.id, text: s.narration, after: 0.45 }] }, null, 2) + '\n');
  console.log(JSON.stringify({ id: s.id, pieceDir: dir }));
}
