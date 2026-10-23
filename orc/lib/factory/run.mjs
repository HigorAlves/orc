// run.mjs — Agent SDK runner behind `orc-stage run`. Spawned by lib/stage.sh
// with ORC_STAGE_IN / _OUT / _PROMPT / _PACK_JSON, ORC_PLUGIN_ROOT, ORC_FACTORY=1.
// Writes <out>/result.json (contract: factory/schema/stage-output.json) and
// <out>/events.jsonl. With ORC_STAGE_DRY_RUN=1 it prints the SDK options and
// skips the model call (and the SDK import).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const env = process.env;
const out = env.ORC_STAGE_OUT;
const dry = env.ORC_STAGE_DRY_RUN === '1';
const pack = JSON.parse(env.ORC_STAGE_PACK_JSON);
const prompt = readFileSync(env.ORC_STAGE_PROMPT, 'utf8');
const cwd = process.cwd();

const options = {
  cwd,
  plugins: [{ type: 'local', path: env.ORC_PLUGIN_ROOT }],
  settingSources: [],
  tools: pack.tools,
  allowedTools: pack.tools,
  permissionMode: 'dontAsk',
  maxTurns: pack.maxTurns,
  outputFormat: { type: 'json_schema', schema: pack.outputSchema },
  env: { ...env, ORC_FACTORY: '1' },
  ...(pack.model ? { model: pack.model } : {}),
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
  const asked = s.kind === 'questions' || (Array.isArray(s.questions) && s.questions.length > 0);
  const outcome = asked ? 'needs_input' : s.kind === 'test_change' ? 'test_change' : !r.ok ? 'fail' : 'pass';
  const summary = String(s.summary || r.text || r.error || '').slice(0, 2000);
  const result = {
    schema: 1,
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
  finish({ ok: true, structured: null, text: 'dry-run' });
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
