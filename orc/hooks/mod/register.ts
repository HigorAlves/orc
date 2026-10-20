// The orc mod: in-process event hooks layered on top of orc's bash settings
// hooks, which stay the safety floor. Nothing here replaces a guard — when
// mods can't load (Claude Code < 2.1.287, --safe-mode, disableAllHooks, an
// org policy) or `mod_enabled` is false, orc behaves exactly as without it.
import type { EngineInterface, On, PluginOptions, RenderSurface } from 'claude-code'
import { statusInfo } from './api'
import { COMPANIONS_NONE, companionsOf, type Companions } from './companions'
import { pickBand, type BandRow } from './band'
import { ciAlt, ciSvg, ciText } from './band/ci'
import { fitSvg, px } from './draw/svg'
import { isRich } from './draw/surface'
import { LEASE_MS, POLL_MS, SETTLED_MS, alertFor, mayPoll, signature, statusLine, summarizeChecks, type CiRecord } from './ci'
import {
  EMPTY, contextChipSvg, currentSlice, cutDiff, diffSlice, digestOf, hintWithContext, parseDecisions, parseMeter, parseReport, parseSession, parseSize, parseSlices, parseUsage, plumbingLine, policyOf, profileOf, spinnerSuffix, summaryText, type SectionId, type Snapshot,
} from './cockpit'
import { parseFeatures, type Features } from './config'
import { gateBadge } from './gates'
import { LEDGER_INITIAL, dropAgent, finishAgent, recordStep, setStep, tagAgent } from './ledger'
import { PANE, drawPane, type Els } from './pane'
import { modelFor, parseProfile, type Profile } from './profiles'
import { costOf } from './prices'
import { agentRows, progressModel } from './progress/model'
import { TOUCHED_INITIAL, applyNumstat, markCommitted, parseNumstat, relPath, touch, touchedRows, type TouchKind } from './touched/model'
import { progressText } from './progress/text'
import { progressAlt, progressSvg } from './progress/svg'
import { DETAILS_INITIAL, LIVE_INITIAL, SECTIONS_INITIAL, ciBox, isOrcStateWrite } from './state'

// State refs: literals in this file, as the engine's scan requires.
const SNAPSHOT_REF = { plugin: 'orc', key: 'snapshot' } as const
const SECTIONS_REF = { plugin: 'orc', key: 'sections' } as const
const LIVE_REF = { plugin: 'orc', key: 'live' } as const
const DETAILS_REF = { plugin: 'orc', key: 'details' } as const
const LEDGER_REF = { plugin: 'orc', key: 'ledger' } as const
const TOUCHED_REF = { plugin: 'orc', key: 'touched' } as const

let alertsSound = false

export function register(on: On, options: PluginOptions) {
  if (options.mod_enabled === false) return
  alertsSound = options.alerts_sound === true
  const features = parseFeatures(options)
  register_session(on)
  register_attribution(on)
  register_compaction(on)
  register_agents(on, parseProfile(options.model_profile))
  register_step_tool(on)
  register_touched(on)
  register_refresh(on)
  register_cockpit(on, parseProfile(options.model_profile))
  register_surfaces(on)
  register_toolrows(on)
  register_gates(on)
  register_band(on, features)
  register_steps(on, features)
  register_api(on)
}

// $.orc: the noun other mods read orc's state through. The method must not need
// `$`, so the snapshot writer (refresh) keeps `lastSnapshot` current.
let companions: Companions = COMPANIONS_NONE
let lastSnapshot: Snapshot = EMPTY

function register_api(on: On) {
  on('engine.create', async (_$, e, next) => {
    companions = companionsOf(e.plugins)
    const built = await next(e)
    return { ...built, orc: { status: async () => statusInfo(lastSnapshot) } }
  })
}

// One session.start hook: add /orc, and in an interactive session start the CI watcher.
function register_session(on: On) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'orc', description: 'orc cockpit — phase, slices, QA, PR, agents, decisions (no model turn)', immediate: true })
    } catch {
      // name taken in this build: the markdown /orc:status stays the fallback
    }
    gitFacts = null
    // The step tool: orc subagents label their TDD steps for the progress view.
    try {
      await $.tool.register({ name: 'step', description: STEP_DESC, inputSchema: STEP_SCHEMA })
    } catch {
      // tools can't register in this build: agents just don't report steps
    }
    void refresh($).catch(() => undefined)
    if (e.isInteractive) $.clock.every(POLL_MS, () => { void ci_tick($) })
    return next(e)
  })
}

// Iron rule 5 at the source: blank the attribution text the model is told to
// write into commits and PRs, so it never drafts a trailer that
// pre-commit-no-ai-attribution.sh then has to deny. The engine's own gate
// sentences (`exemption`, `remedy`) pass through; the bash deny stays as backstop.
function register_attribution(on: On) {
  on('attribution.text', { kind: ['commit', 'pr'] }, async ($, e, next) => {
    if ((await $.env.get('ORC_ALLOW_AI_ATTRIBUTION')) === '1') return next(e)
    return { text: '' }
  })
}

// Compaction keeps orc's place: the summarizer is told the live session state
// (`orc-state line` — command, phase, slices, policy) so the post-compact
// transcript still knows where the flow is. The PreCompact bash hook writes the
// same facts to checkpoint.md for /orc:resume; this covers the live session.
// Speculative precomputes and subagent transcripts are left alone.
function register_compaction(on: On) {
  on('session.compact', { trigger: ['manual', 'auto'] }, async ($, e, next) => {
    if (e.agentId) return next(e)
    const line = await orc_state($, ['line'])
    if (!line) return next(e)
    const note = 'orc session state (authoritative, from orc-state): ' + line +
      ' — keep the current phase, slice progress, and any pending gate decision in the summary.'
    return next({ ...e, instructions: e.instructions ? e.instructions + '\n\n' + note : note })
  })
}

// Every orc-state write the model runs through Bash re-reads .orc/ into state;
// subscribed drawings redraw by themselves. (Main-loop turns refresh in the
// turn.complete hook below — one registration per event without a matcher.)
function register_refresh(on: On) {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    // 2.1.291 types the Bash call flat (`e.command`); older builds nested it under `input`.
    const call = e as { command?: string; input?: { command?: string } }
    const command = call.command ?? call.input?.command ?? ''
    if (isOrcStateWrite(command)) await refresh($).catch(() => undefined)
    if (GIT_COMMIT.test(command) && !failed(result)) await commit_touched($)
    return result
  })
}

// orc agents: model_profile picks the model when the Agent call named none
// (never over an explicit one — an escalation step-up), and every finished orc
// subagent run lands in the usage ledger (`orc-state usage add`) — the data the
// routing is re-tuned from.
const agentTypes = new Map<string, string>()

function register_agents(on: On, profile: Profile) {
  // Both hooks gate the engine (a dispatch, a turn's end): orc's bookkeeping
  // never fails them, so every state call here is guarded.
  on('agent.spawn', async ($, e, next) => {
    const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
    const model = e.model ? undefined : modelFor(profileOf(snap, profile), e.subagentType)
    const brief = /^(orc:)?orc-implementer$/.test(e.subagentType) && !e.prompt.includes('mcp__orc__step') ? { prompt: e.prompt + STEP_BRIEF } : null
    const result = await next(model || brief ? { ...e, ...(model ? { model } : {}), ...brief } : e)
    if (result.agentId && /^(orc:)?orc-/.test(e.subagentType)) {
      agentTypes.set(result.agentId, e.subagentType.replace(/^orc:/, ''))
      await $.state.set(LIVE_REF, { agent: e.subagentType.replace(/^orc:/, ''), since: await $.clock.now().catch(() => null) }).catch(() => undefined)
      const cur = await $.state.get(LEDGER_REF).then(r => r.value ?? LEDGER_INITIAL, () => LEDGER_INITIAL)
      await $.state.set(LEDGER_REF, tagAgent(cur, result.agentId, e.subagentType.replace(/^orc:/, ''))).catch(() => undefined)
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      await refresh($).catch(() => undefined)
      // Finished agent rows showed once; the next main-loop completion clears them.
      const cur = await $.state.get(LEDGER_REF).then(r => r.value ?? LEDGER_INITIAL, () => LEDGER_INITIAL)
      const kept = Object.keys(cur.agents).filter(id => !agentTypes.has(id)).reduce(dropAgent, cur)
      if (kept !== cur) await $.state.set(LEDGER_REF, kept).catch(() => undefined)
    }
    const agent = e.agentId ? agentTypes.get(e.agentId) : undefined
    if (agent) {
      // Cleared on every finish — an abort or API error carries no usage but the agent is gone.
      agentTypes.delete(e.agentId as string)
      // An explicit finish stamp: the agent row stops reading as running.
      const at = await $.clock.now().catch(() => 0)
      const cur = await $.state.get(LEDGER_REF).then(r => r.value ?? LEDGER_INITIAL, () => LEDGER_INITIAL)
      const stamped = finishAgent(cur, e.agentId as string, at)
      if (stamped !== cur) await $.state.set(LEDGER_REF, stamped).catch(() => undefined)
      const remaining = [...agentTypes.values()].at(-1) ?? null
      await $.state.set(LIVE_REF, remaining ? { agent: remaining, since: null } : LIVE_INITIAL).catch(() => undefined)
      if (e.usage) {
        await orc_state($, ['usage', 'add', '--agent', agent, '--model', e.usage.model,
          '--in', String(e.usage.input_tokens), '--out', String(e.usage.output_tokens), '--ms', String(e.durationMs)])
      }
    }
    return result
  })
}

// The step tool (mcp__orc__step): orc subagents report "writing failing test 2/5";
// the label feeds the cockpit's agent rows. A label for the user, not a gate.
const STEP_DESC = 'Report the current step of your work for the user\'s progress view. Only orc subagents use this.'
const STEP_SCHEMA = { type: 'object', properties: { label: { type: 'string' }, n: { type: 'integer' }, of: { type: 'integer' } }, required: ['label'] }
const STEP_BRIEF = '\n\nProgress: at the start of each TDD step call mcp__orc__step with { label, n, of } (e.g. { label: \'writing failing test\', n: 2, of: 5 }). It is a label for the user\'s progress view, not a gate.'

function register_step_tool(on: On) {
  // Registered tools are mcp__-named, so the engine would defer them behind ToolSearch; pin it in the prompt list.
  on('tool.describe', { tool: 'mcp__orc__step' }, async (_$, e, next) => {
    const r = await next(e)
    return { ...r, isDeferred: false }
  })

  on('tool.call', { tool: 'mcp__orc__step' }, async ($, e) => {
    const call = e as { agentId?: string; label?: unknown; n?: unknown; of?: unknown }
    if (!call.agentId) return { result: 'ignored: only orc subagents report steps' }
    try {
      const step = { label: String(call.label ?? '').slice(0, 80), n: Number(call.n) || 0, of: Number(call.of) || 0 }
      const cur = (await $.state.get(LEDGER_REF)).value ?? LEDGER_INITIAL
      await $.state.set(LEDGER_REF, setStep(cur, call.agentId, step))
    } catch { /* a label never fails the agent */ }
    return { result: 'ok' }
  })
}

// --- Touched files -----------------------------------------------------------
// What the session read, edited and committed during the current slice. Reads
// and edits are recorded after the tool ran (a denied or errored call marks
// nothing); a `git commit` through Bash promotes the slice's edits to committed.
const GIT_COMMIT = /(^|[;&|]\s*)git\s+(-C\s+\S+\s+)?commit\b/
const failed = (r: unknown) => { const x = r as { deny?: unknown; isError?: unknown }; return !!x.deny || !!x.isError }

type GitFacts = { root: string; gitDir: string; mergeBase: string }
let gitFacts: GitFacts | null = null

// Repo root, git dir and the point the branch left the base: once per session (not cached when git can't answer).
async function git_facts($: EngineInterface): Promise<GitFacts> {
  if (gitFacts) return gitFacts
  const run = (argv: string[]) => $.process.run(['git', ...argv], { timeoutMs: 5000 }).then(r => (r.exitCode === 0 ? r.stdout.trim() : ''), () => '')
  const [root = '', gitDir = ''] = (await run(['rev-parse', '--show-toplevel', '--absolute-git-dir'])).split('\n')
  const head = await run(['rev-parse', '--abbrev-ref', 'origin/HEAD'])
  const base = head && head !== 'origin/HEAD' ? head : 'origin/main'
  const facts = { root, gitDir, mergeBase: (await run(['merge-base', 'HEAD', base])) || base }
  if (root) gitFacts = facts
  return facts
}

async function touch_files($: EngineInterface, paths: string[], kind: TouchKind): Promise<void> {
  try {
    const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
    const slice = snap.session ? currentSlice(snap.slices) : null
    if (!slice || !paths.length) return
    const { root } = await git_facts($)
    const at = await $.clock.now()
    let t = (await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL
    for (const p of paths) t = touch(t, { sliceId: slice.id, path: relPath(p, root), kind, at })
    await $.state.set(TOUCHED_REF, t)
    await touched_counts($)
  } catch { /* bookkeeping never fails a tool call */ }
}

async function commit_touched($: EngineInterface): Promise<void> {
  try {
    const t = (await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL
    if (t.files.some(f => f.kind === 'edit')) await $.state.set(TOUCHED_REF, markCommitted(t, await $.clock.now()))
    await touched_counts($)
  } catch { /* ignore */ }
}

// Line counts come from git, re-read only when the index or HEAD changed.
// (State writes are refused while a drawing renders, so this runs from events, never from ui.render.)
async function touched_counts($: EngineInterface): Promise<void> {
  try {
    if (!((await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL).files.length) return
    const g = await git_facts($)
    if (!g.gitDir) return
    const stamp = (await Promise.all(['index', 'HEAD'].map(f => $.fs.stat(g.gitDir + '/' + f).then(st => st.mtimeMs, () => 0)))).join(':')
    if (stamp === ((await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL).stamp) return
    const r = await $.process.run(['git', '-C', g.root, 'diff', '--numstat', g.mergeBase], { timeoutMs: 10000 })
    const fresh = (await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL
    await $.state.set(TOUCHED_REF, applyNumstat(fresh, r.exitCode === 0 ? parseNumstat(r.stdout) : new Map(), stamp))
  } catch { /* counts stay as they were */ }
}

function register_touched(on: On) {
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e)
    if (!failed(result)) await touch_files($, [String((e as { file_path?: string }).file_path ?? '')].filter(Boolean), 'read')
    return result
  })

  on('tool.call', { tool: ['Grep', 'Glob'] }, async ($, e, next) => {
    const result = await next(e)
    if (failed(result)) return result
    const names = (result as { result?: { filenames?: unknown } }).result?.filenames
    if (Array.isArray(names)) await touch_files($, names.filter((n): n is string => typeof n === 'string').slice(0, 10), 'read')
    return result
  })

  // Shared with the replay recorder (later): each observer step runs after a successful edit.
  on('tool.call', { tool: ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'] }, async ($, e, next) => {
    const result = await next(e)
    if (failed(result)) return result
    const call = e as { file_path?: string; notebook_path?: string }
    await touch_files($, [call.file_path ?? call.notebook_path ?? ''].filter(Boolean), 'edit')
    return result
  })
}

// The only turn.step hook: every model request's usage lands in the ledger
// (main loop, or the subagent named by agentId). Later slices extend the body.
function register_steps(on: On, _features: Features) {
  on('turn.step', async function* ($, e, next) {
    const startedAt = await $.clock.now().catch(() => 0)
    const result = yield* next(e)
    try {
      const at = await $.clock.now()
      const cur = (await $.state.get(LEDGER_REF)).value ?? LEDGER_INITIAL
      await $.state.set(LEDGER_REF, recordStep(cur, { agentId: e.agentId ?? null, usage: result?.usage ?? null, at, ms: at - startedAt }))
    } catch { /* bookkeeping never fails a request */ }
    return result
  })
}

// orc outside the pane: the spinner's suffix, the idle prompt hint and the mode
// footer. Each is a prop rewrite; the engine keeps drawing its own line.
function register_surfaces(on: On) {
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
    const live = await $.state.get(LIVE_REF).then(r => r.value ?? LIVE_INITIAL, () => LIVE_INITIAL)
    const suffix = spinnerSuffix(snap, live.agent)
    return suffix ? next({ ...e, props: { ...e.props, suffix: e.props.suffix + suffix } }) : next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.props.isWorking || e.props.isDraft) return next(e)
    const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
    const usage = await $.session.usage().then(u => u, () => null)
    const percent = parseMeter(usage)?.contextPercent ?? null
    const trail = ((await $.state.get(LEDGER_REF).then(r => r.value, () => undefined)) ?? LEDGER_INITIAL).main.trail
    const window = usage?.context?.window ?? 200_000
    const hint = hintWithContext(snap, percent, trail, window)
    if (!hint) return next(e)
    const els = $.ui.resolve(e)
    // Desktop: the ring and bars as a drawing, then the same words.
    if (percent != null && isRich(e.surface) && 'Svg' in els) {
      const source = fitSvg(contextChipSvg(percent, trail, window))
      if (source) return els.Box({ flexDirection: 'row', columnGap: 1, children: [
        els.Svg({ source, alt: `context ${percent}% used`, width: 72, height: 18 }),
        els.Text({ dimColor: true, children: [hint] }),
      ] })
    }
    return next({ ...e, props: { ...e.props, hint } })
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const policy = policyOf(await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY))
    return policy && policy !== 'manual' ? next({ ...e, props: { ...e.props, modes: [...e.props.modes, 'orc ' + policy] } }) : next(e)
  })
}

// ToolUse rows for orc's own plumbing (orc-state, orc-pr-size, orc-report,
// gh pr checks) collapse to one dim line; errors and everything else keep the engine row.
function register_toolrows(on: On) {
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || e.props.isErrored || e.props.isInterrupted) return next(e)
    const text = plumbingLine(e.props.input, e.props.isRunning)
    if (!text) return next(e)
    const { Text } = $.ui.resolve(e)
    return Text({ dimColor: true, children: [text] })
  })
}

// Gate chrome: outward and escalation gates (orc:gates header chips) get a
// badge above the engine's own dialog, which is kept exactly once.
function register_gates(on: On) {
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const badge = gateBadge(e.props.questions)
    if (!badge) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return Box({ flexDirection: 'column', children: [Text({ bold: true, color: 'yellow', children: [badge] }), await next(e)] })
  })
}

// --- CI watcher (one poller across sessions, via a $.store lease) ----------
let ciBusy = false

async function ci_tick($: EngineInterface): Promise<void> {
  if (ciBusy) return
  ciBusy = true
  try {
    const session = parseSession(await orc_state($, ['get']))
    const prs = (session?.linkedPRs ?? []).filter(p => p.url)
    if (!prs.length) return
    const sid = await $.session.id()
    for (const pr of prs) {
      const key = 'ci:' + pr.url
      const label = pr.number ?? (pr.url as string)
      const now = await $.clock.now()
      const rec = ((await $.store.get(key)) ?? {}) as CiRecord
      const settled = rec.summary && rec.summary.state !== 'pending' && rec.checkedAt !== undefined && now - rec.checkedAt < SETTLED_MS
      if (!mayPoll(rec.lease, sid, now) || settled) {
        if (rec.summary) $.ui.status(statusLine(label, rec.summary))
        continue
      }
      await $.store.set(key, { ...rec, lease: { sid, until: now + LEASE_MS } })
      // The URL resolves from any directory; a bare number needs the cwd's remote.
      const r = await $.process.run(['gh', 'pr', 'checks', String(pr.url ?? label), '--json', 'name,bucket'], { timeoutMs: 20000 })
      const summary = summarizeChecks(r.stdout)
      const fresh = ((await $.store.get(key)) ?? {}) as CiRecord
      const kind = alertFor(fresh.summary, summary, fresh.notified)
      await $.store.set(key, { lease: { sid, until: now + LEASE_MS }, summary, checkedAt: now, notified: kind ? signature(summary) : fresh.notified })
      $.ui.status(statusLine(label, summary))
      if (kind === 'red') {
        ciBox.alert = { pr: label, summary }
        $.ui.toast(`CI red on #${label}: ${summary.failing.join(', ')} — /orc:ci to diagnose`)
        await $.prompt.suggest({ text: '/orc:ci ' + label })
        if (alertsSound) await $.audio.play({ asset: 'hooks/mod/chime.wav' })
      } else if (kind === 'green') {
        ciBox.alert = null
        $.ui.toast(`CI green on #${label}`)
        if (alertsSound) await $.audio.play({ asset: 'hooks/mod/chime.wav' })
      }
      $.ui.invalidate('ui.render')
    }
  } catch {
    // gh missing, offline, not authenticated: stay quiet and try next tick
  } finally {
    ciBusy = false
  }
}

// The one band above the prompt: orc offers rows, pickBand keeps the
// highest-priority one. No orc row (or a survey) leaves the engine's drawing alone.
function register_band(on: On, features: Features) {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ci: BandRow | null = ciBox.alert ? { kind: 'ci', pr: ciBox.alert.pr, failing: ciBox.alert.summary.failing } : null
    const progress = features.progressBand ? await progress_row($) : null
    // guard, sentinel, retro and cache rows join here in later slices
    const row = pickBand([ci, progress])
    if (!row) return next(e)
    const below = await next(e)
    const els = $.ui.resolve(e)
    const mine = draw_band_row($, e, els, row)
    return els.Box({ flexDirection: 'column', children: [mine, below] })
  })
}

async function progress_row($: EngineInterface): Promise<BandRow | null> {
  const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
  const ledger = await $.state.get(LEDGER_REF).then(r => r.value ?? LEDGER_INITIAL, () => LEDGER_INITIAL)
  const model = progressModel(snap, ledger)
  return model ? { kind: 'progress', model } : null
}

// One row, drawn for the surface: SVG strip + real Buttons on rich surfaces, text elsewhere.
function draw_band_row($: EngineInterface, e: { surface: RenderSurface | null; props: { bodyColumns: number } }, els: Els, row: BandRow) {
  if (row.kind === 'ci') {
    const actions = {
      diagnose: () => { $.prompt.fill({ text: '/orc:ci ' + row.pr }) },
      dismiss: () => { ciBox.alert = null; $.ui.invalidate('ui.render') },
    }
    if (isRich(e.surface) && 'Svg' in els) {
      return els.Box({ flexDirection: 'row', columnGap: 2, children: [
        els.Svg({ source: fitSvg(ciSvg(row, px(e.props.bodyColumns))) ?? '', alt: ciAlt(row), height: 28 }),
        els.Button({ key: 'ci-diagnose', label: 'Diagnose', onPress: actions.diagnose }),
        els.Button({ key: 'ci-dismiss', label: 'Dismiss', onPress: actions.dismiss }),
      ] })
    }
    return ciText(els, row, actions)
  }
  if (row.kind === 'progress') {
    const m = row.model
    const next = m.next
    const go = next ? [els.Button({ key: 'orc-next', hotkey: '1', label: next, onPress: () => { $.prompt.fill({ text: next }).catch(() => undefined) } })] : []
    const source = isRich(e.surface) && 'Svg' in els ? fitSvg(progressSvg(m, px(e.props.bodyColumns))) : null
    const drawn = source && 'Svg' in els
      ? els.Svg({ source, alt: progressAlt(m), height: 28 })
      : els.Text({ children: [progressText(m, e.props.bodyColumns)] })
    return els.Box({ flexDirection: 'row', columnGap: 2, children: [drawn, ...go] })
  }
  return els.Text({ children: [] })
}

// --- /orc cockpit -----------------------------------------------------------
// A dashboard pane drawn from $.state, no model turn: header strip, phase
// ladder beside the slice ledger. Where nothing can draw (VS Code, claude -p)
// it answers with a text summary.
function register_cockpit(on: On, fallbackProfile: Profile) {
  on('command.run', { command: 'orc' }, async ($) => {
    await refresh($).catch(() => undefined)
    const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
    // A plain `claude -p` run has no surface (ui.open still reports "placed").
    if ((await $.session.surfaces()).length) {
      try {
        if ((await $.ui.open({ id: PANE, title: 'orc', focus: true, closeOnEscape: true, rows: 16, columns: 76 })).isPlaced) return {}
      } catch {
        // the pane was refused: fall through to the text answer
      }
    }
    return { text: summaryText(snap) }
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const snap = (await $.state.get(SNAPSHOT_REF)).value ?? EMPTY
    const sections = (await $.state.get(SECTIONS_REF)).value ?? SECTIONS_INITIAL
    const details = (await $.state.get(DETAILS_REF)).value ?? DETAILS_INITIAL
    const ledger = (await $.state.get(LEDGER_REF)).value ?? LEDGER_INITIAL
    const now = await $.clock.now().catch(() => 0)
    const agents = agentRows(ledger, costOf, now)
    const touched = touchedRows((await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL, now)
    const model = { snap, sections, details, agents, touched, rich: isRich(e.surface), ciAlert: ciBox.alert, profile: profileOf(snap, fallbackProfile), placement: e.props.placement, bodyColumns: e.props.bodyColumns }
    return drawPane($.ui.resolve(e), model, {
      resume: () => { $.prompt.fill({ text: snap.session ? '/orc:resume' : '/orc:flow ' }) },
      toggle: (id: SectionId) => async () => {
        try {
          const current = (await $.state.get(SECTIONS_REF)).value ?? SECTIONS_INITIAL
          await $.state.set(SECTIONS_REF, { ...current, [id]: !current[id] })
          if (!current[id]) await load_details($, id)
          if (!current[id] && id === 'touched') await touched_counts($)
        } catch {
          // a state or loader failure leaves the pane as drawn
        }
      },
      // The user picked it in the pane, so it settles as an asked decision.
      settle: async (key: string, value: string) => {
        await orc_state($, ['decision', 'set', key, value, '--provenance', 'asked', '--supersede'])
        await refresh($).catch(() => undefined)
      },
      renderReport: async () => {
        const path = await orc_report_html($)
        $.ui.toast(path ? 'QA report: ' + path : 'No QA packet to render')
      },
    })
  })
}

// --- Snapshot loader (the one writer of the `snapshot` atom) ----------------
// Lives here, not in state.ts: the engine follows `$` only within this file.
async function load_snapshot($: EngineInterface): Promise<Snapshot> {
  const root = $.plugin.root + '/bin/'
  const run = (argv: string[]) => $.process.run([root + argv[0], ...argv.slice(1)], { timeoutMs: 10000 }).then(r => (r.exitCode === 0 ? r.stdout : ''), () => '')
  const session = await run(['orc-state', 'get'])
  if (!parseSession(session)) return EMPTY // no orc session on this branch: nothing else to read
  const [slices, decisions, qa, loc, budget, usage, meter] = await Promise.all([
    run(['orc-state', 'slice', 'list']), run(['orc-state', 'decision', 'get']), run(['orc-report', 'json']),
    run(['orc-pr-size', 'loc']), run(['orc-pr-size', 'budget']), run(['orc-state', 'usage', 'summary']),
    $.session.usage().then(u => u, () => null),
  ])
  return {
    session: parseSession(session), slices: parseSlices(slices), decisions: parseDecisions(decisions),
    qa: parseReport(qa), size: parseSize(loc, budget), usage: parseUsage(usage), meter: parseMeter(meter),
  }
}

// One loader at a time; a trigger during a load queues exactly one more.
let inflight: Promise<void> | null = null
let dirty = false
function refresh($: EngineInterface): Promise<void> {
  if (inflight) { dirty = true; return inflight }
  inflight = (async () => {
    do {
      dirty = false
      lastSnapshot = await load_snapshot($)
      await $.state.set(SNAPSHOT_REF, lastSnapshot)
      await touched_counts($)
      // Open Digest/Diff sections reload against the new snapshot; closed ones start clean next time.
      const open = (await $.state.get(SECTIONS_REF)).value ?? SECTIONS_INITIAL
      if (!open.digest && !open.diff) await $.state.set(DETAILS_REF, DETAILS_INITIAL)
      if (open.digest) await load_details($, 'digest')
      if (open.diff) await load_details($, 'diff')
    } while (dirty)
  })().finally(() => { inflight = null })
  return inflight
}

async function orc_report_html($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run([$.plugin.root + '/bin/orc-report', 'html'], { timeoutMs: 10000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

// Digest and diff load from the live snapshot when their section is open.
async function load_details($: EngineInterface, id: SectionId): Promise<void> {
  const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
  if (id === 'digest') await load_digest($, snap)
  if (id === 'diff') await load_diff($, snap)
}

// checkpoint.md's digest, read once per open; '' is drawn as "no digest".
async function load_digest($: EngineInterface, snap: Snapshot): Promise<void> {
  const branch = snap.session?.branch
  if (!branch) return
  // ORC_STATE_DIR is absolute when the SessionStart hook exported it; else orc-state's default, <git root>/.orc.
  const env = await $.env.get('ORC_STATE_DIR').catch(() => undefined)
  const top = env ? '' : await $.process.run(['git', 'rev-parse', '--show-toplevel'], { timeoutMs: 5000 }).then(r => (r.exitCode === 0 ? r.stdout.trim() : ''), () => '')
  const root = env || (top ? top + '/.orc' : '.orc')
  const text = await $.fs.read(`${root}/${branch}/files/checkpoint.md`).then(t => (typeof t === 'string' ? t : ''), () => '')
  const d = (await $.state.get(DETAILS_REF)).value ?? DETAILS_INITIAL
  await $.state.set(DETAILS_REF, { ...d, digest: digestOf(text) ?? '' })
}

// The current slice's diff: its commit when it has one, else the working tree.
async function load_diff($: EngineInterface, snap: Snapshot): Promise<void> {
  const cur = diffSlice(snap.slices)
  const argv = cur?.commit ? ['git', 'show', '--no-color', '--format=', '-U1', cur.commit] : ['git', 'diff', '--no-color', '-U1']
  const out = await $.process.run(argv, { timeoutMs: 10000 }).then(r => (r.exitCode === 0 ? r.stdout : ''), () => '')
  const { source, truncated } = cutDiff(out)
  const d = (await $.state.get(DETAILS_REF)).value ?? DETAILS_INITIAL
  await $.state.set(DETAILS_REF, { ...d, diff: source, diffTruncated: truncated })
}

// One orc-state call; '' when it fails or there is no session.
async function orc_state($: EngineInterface, argv: string[]): Promise<string> {
  try {
    const r = await $.process.run([$.plugin.root + '/bin/orc-state', ...argv], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}
