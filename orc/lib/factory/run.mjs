// run.mjs — Agent SDK runner behind `orc-stage run`. Spawned by lib/stage.sh
// with ORC_STAGE_IN / _OUT / _PROMPT / _PACK_JSON, ORC_PLUGIN_ROOT, ORC_FACTORY=1.
// Writes <out>/result.json (contract: factory/schema/stage-output.json) and
// <out>/events.jsonl. With ORC_STAGE_DRY_RUN=1 it prints the SDK options and
// skips the model call (and the SDK import).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const env = process.env;
const out = env.ORC_STAGE_OUT;
const dry = env.ORC_STAGE_DRY_RUN === '1';
const pack = JSON.parse(env.ORC_STAGE_PACK_JSON);
// The controller may size a stage to the work (implementing's turns by slice count): the
// input's limits win over the pack's defaults.
const inputLimits = (() => {
  try {
    return env.ORC_STAGE_IN ? JSON.parse(readFileSync(env.ORC_STAGE_IN, 'utf8')).limits ?? {} : {};
  } catch {
    return {};
  }
})();
const prompt = readFileSync(env.ORC_STAGE_PROMPT, 'utf8');
const cwd = process.cwd();

// The SDK's `tools` takes bare built-in names ('Bash', 'Read'); a permission pattern such
// as 'Bash(git commit:*)' names no tool there, and the pack would silently lose Bash.
// The patterns go in `allowedTools`, so dontAsk still denies any command not listed.
const builtins = [...new Set(pack.tools.map((t) => t.replace(/\(.*\)$/, '')).filter((t) => !t.startsWith('mcp__')))];

// A plugin agent file: YAML-ish frontmatter (model, effort) and a markdown body. The pack
// names the agent, but the SDK's `query` is not a subagent dispatch: nothing loads that
// file unless this runner does. Same for the pack's skills, which the agent would
// otherwise reach only through a Skill tool no pack allows.
const splitFrontmatter = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text.trim() };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(m[0].length).trim() };
};
const readText = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
};
const agentFile = pack.agent ? readText(join(env.ORC_PLUGIN_ROOT, 'agents', `${pack.agent}.md`)) : null;
const agent = agentFile ? splitFrontmatter(agentFile) : null;
const skillBodies = (pack.skills ?? [])
  .map((id) => [id, readText(join(env.ORC_PLUGIN_ROOT, 'skills', id.replace(/^orc:/, ''), 'SKILL.md'))])
  .filter(([, text]) => text)
  .map(([id, text]) => `## Skill: ${id}\n\n${splitFrontmatter(text).body}`);
const systemAppend = agent ? [agent.body, ...skillBodies].join('\n\n') : null;
const model = pack.model ?? agent?.meta.model ?? null;
const effort = agent?.meta.effort ?? null;

const options = {
  cwd,
  plugins: [{ type: 'local', path: env.ORC_PLUGIN_ROOT }],
  settingSources: [],
  tools: builtins,
  allowedTools: pack.tools,
  permissionMode: 'dontAsk',
  maxTurns: Number.isInteger(inputLimits.maxTurns) && inputLimits.maxTurns > 0 ? inputLimits.maxTurns : pack.maxTurns,
  outputFormat: { type: 'json_schema', schema: pack.outputSchema },
  env: { ...env, ORC_FACTORY: '1' },
  ...(systemAppend ? { systemPrompt: { type: 'preset', preset: 'claude_code', append: systemAppend } } : {}),
  ...(model ? { model } : {}),
  ...(effort ? { effort } : {}),
};

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

const kindOf = (rel) => {
  const b = basename(rel);
  if (b === 'qa-manifest.json') return 'qa-manifest';
  if (b === 'findings.json') return 'findings';
  if (b === 'rules.md') return 'rules';
  if (b === 'report.html') return 'report';
  if (/\.(png|jpe?g)$/i.test(b)) return 'screenshot';
  if (/\.(webm|mp4)$/i.test(b)) return 'video';
  if (/\.har$/i.test(b)) return 'har';
  if (/\.diff$/i.test(b)) return 'diff';
  if (rel.startsWith('files/tests/')) return 'test';
  return 'report';
};

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.isFile() ? [join(dir, e.name)] : [],
  );

const scanArtifacts = () => {
  const root = join(out, 'files');
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  return walk(root)
    .map((abs) => relative(out, abs))
    .sort()
    .map((rel) => ({
      kind: kindOf(rel),
      path: rel,
      label: basename(rel),
      sha256: createHash('sha256').update(readFileSync(join(out, rel))).digest('hex'),
    }));
};

// Ledger lives in <state dir>/<sanitized branch>/files/ (see orc-state).
const ledgerDir = () => {
  const branch = git(['branch', '--show-current']);
  if (!branch) return null;
  const sid = branch.replace(/\//g, '-').replace(/[^a-zA-Z0-9._-]/g, '-');
  const root = env.ORC_STATE_DIR || join(git(['rev-parse', '--show-toplevel']) || cwd, '.orc');
  return join(root, sid, 'files');
};

const SLICE_KIND = { red: 'slice.red', green: 'slice.green', committed: 'slice.committed', escalated: 'escalation' };

const readLedger = () => {
  const dir = ledgerDir();
  const slices = (dir && readJson(join(dir, 'slices.json'))?.slices) || [];
  let usageRows = [];
  if (dir && existsSync(join(dir, 'usage.jsonl'))) {
    usageRows = readFileSync(join(dir, 'usage.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      });
  }
  return { slices, usageRows };
};

const writeEvents = (ledger, outcome) => {
  const lines = [
    ...ledger.usageRows.map((payload) => ({ kind: 'note', payload })),
    ...ledger.slices
      .filter((s) => s.status && s.status !== 'pending' && SLICE_KIND[s.status])
      .map((s) => ({ kind: SLICE_KIND[s.status], payload: { id: s.id, title: s.title, commit: s.commit ?? null } })),
    { kind: 'note', payload: { phase: 'stage_end', outcome } },
  ];
  writeFileSync(join(out, 'events.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
};

const finish = (r) => {
  const ledger = readLedger();
  const s = r.structured ?? {};
  if (typeof s.rulesMarkdown === 'string' && s.rulesMarkdown.trim()) {
    mkdirSync(join(out, 'files'), { recursive: true });
    writeFileSync(join(out, 'files', 'rules.md'), s.rulesMarkdown.endsWith('\n') ? s.rulesMarkdown : s.rulesMarkdown + '\n');
  }
  const asked = s.kind === 'questions' || (Array.isArray(s.questions) && s.questions.length > 0);
  // An agent that stops on purpose is `escalated` (schema 2): the controller escalates the
  // task with `answer.reason` instead of verifying an empty change.
  const outcome = asked
    ? 'needs_input'
    : s.kind === 'test_change'
      ? 'test_change'
      : s.kind === 'escalated'
        ? 'escalated'
        : !r.ok
          ? 'fail'
          : 'pass';
  const summary = String(s.summary || r.text || r.error || '').slice(0, 2000);
  const result = {
    schema: 2,
    ok: r.ok,
    outcome,
    summary,
    needsInput: asked ? (s.questions ?? []) : null,
    requested: s.requested ?? [],
    findings: s.findings ?? [],
    artifacts: scanArtifacts(),
    slices: {
      done: ledger.slices.filter((x) => x.status === 'committed' || x.status === 'green').length,
      total: ledger.slices.length,
    },
    commit: s.commit ?? null,
    // The pack's whole structured answer, so the controller keeps what the
    // summary drops (triage criteria/assumptions/slices, review verdicts).
    answer: r.structured ?? null,
    usage: {
      turns: r.turns ?? 0,
      costUsd: r.costUsd ?? null,
      durationMs: Math.round(r.durationMs ?? 0),
      model: s.model ?? options.model ?? '',
    },
    error: r.error ?? null,
    rateLimited: Boolean(r.rateLimited),
    resetsAt: r.resetsAt ?? null,
  };
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  writeEvents(ledger, outcome);
  return result;
};

if (dry) {
  console.log(JSON.stringify(options, null, 2));
  let structured = null;
  try {
    structured = env.ORC_STAGE_DRY_STRUCTURED ? JSON.parse(env.ORC_STAGE_DRY_STRUCTURED) : null; // test seam
  } catch {}
  finish({ ok: true, structured, text: 'dry-run' });
  process.exit(0);
}

// Script-only pack (agent: null): no model, no SDK import. Outcome comes from the QA manifest.
if (pack.agent == null) {
  const m = readJson(join(out, 'files', 'qa', 'qa-manifest.json'));
  const verdict = m?.verdict ?? null;
  const good = verdict === 'pass' || verdict === 'skipped';
  const note = good ? `qa ${verdict}` : m ? `qa verdict: ${verdict ?? 'missing'}` : 'qa-manifest.json missing or unreadable';
  finish({ ok: good, structured: null, text: note, error: good ? null : note });
  process.exit(0);
}

const t0 = Date.now();
const state = { ok: false, rateLimited: false, resetsAt: null, error: null, structured: null, text: '', turns: 0, costUsd: null, durationMs: 0 };

try {
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  for await (const msg of query({ prompt, options })) {
    if (msg.type === 'assistant') {
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'text' && block.text) console.log(block.text);
        else if (block.type === 'tool_use') {
          const i = block.input ?? {};
          const target = i.file_path ?? i.path ?? i.command ?? i.pattern ?? i.url ?? '';
          console.log(`→ ${block.name} ${String(target).split('\n')[0].slice(0, 160)}`.trimEnd());
        }
      }
    } else if (msg.type === 'rate_limit_event') {
      const info = msg.rate_limit_info ?? {};
      if (info.status && info.status !== 'allowed') {
        state.rateLimited = true;
        state.resetsAt = info.resetsAt != null ? String(info.resetsAt) : null;
      }
    } else if (msg.type === 'result') {
      state.ok = msg.subtype === 'success' && !msg.is_error;
      state.structured = msg.structured_output ?? null;
      state.text = typeof msg.result === 'string' ? msg.result : '';
      state.turns = msg.num_turns ?? 0;
      state.costUsd = msg.total_cost_usd ?? null;
      state.durationMs = msg.duration_ms ?? 0;
      if (!state.ok) state.error = msg.result || msg.subtype || 'error';
      // The result is the end of the stage. Do not wait for the stream to close: a dev server
      // the agent left running in the background keeps the CLI's stdio open, and with it the
      // container, until the controller's timeout kills it.
      break;
    }
  }
} catch (e) {
  state.ok = false;
  state.error = e instanceof Error ? e.message : String(e);
}

if (state.error && /usage limit|rate limit/i.test(String(state.error))) state.rateLimited = true;
if (!state.durationMs) state.durationMs = Date.now() - t0;
if (state.ok && state.structured === null && !state.text) {
  state.ok = false;
  state.error = 'no structured output';
}
finish(state);
// Same reason as the break above: nothing an agent left behind may keep this process alive.
process.exit(0);
