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
import { classify } from './guard/classify'
import { measurePlan, summarize, type GuardSummary } from './guard/measure'
import { guardSvg } from './guard/svg'
import { guardText } from './guard/text'
import { isRich } from './draw/surface'
import { LEASE_MS, POLL_MS, SETTLED_MS, alertFor, mayPoll, signature, statusLine, summarizeChecks, type CiRecord } from './ci'
import {
  EMPTY, contextChipSvg, currentSlice, cutDiff, diffSlice, digestOf, hintWithContext, parseDecisions, parseMeter, parseReport, parseSession, parseSize, parseSlices, parseUsage, plumbingLine, policyOf, profileOf, spinnerSuffix, summaryText, type SectionId, type Snapshot,
} from './cockpit'
import { parseFeatures, type Features } from './config'
import { gateBadge } from './gates'
import { LEDGER_INITIAL, dropAgent, finishAgent, recordStep, setStep, tagAgent } from './ledger'
import { PANE, drawPane, type Els } from './pane'
import { MAX_PROBED, countDependents, parseAffected, parseNames } from './radius/model'
import { modelFor, parseProfile, type Profile } from './profiles'
import { costOf } from './prices'
import { agentRows, progressModel } from './progress/model'
import { TOUCHED_INITIAL, applyNumstat, markCommitted, parseNumstat, relPath, touch, touchedRows, type TouchKind } from './touched/model'
import { progressText } from './progress/text'
import { progressAlt, progressSvg } from './progress/svg'
import { COLD_MIN_TOKENS, cacheState, coldToast, isColdRewrite, parseDuration, pingEvery, pingGone, type CacheView } from './cache/model'
import { cacheSvg } from './cache/svg'
import { cacheAlt, cacheText } from './cache/text'
import { openPlan, parseThumbs, pixelTerminal } from './qa/model'
import { REPLAY_INITIAL, recordEdit, replayView, type ReplayState } from './replay/model'
import { cleanRule, similarity } from './retro/clean'
import { mayBeCorrection } from './retro/detect'
import { HAIKU, RETRO_SYSTEM, parseRetro, retroPrompt, rulesSection, savedRules } from './retro/prompt'
import { mergeCandidate, renderRules, spliceRules, type CandidateFile } from './retro/store'
import { retroSvg } from './retro/svg'
import { retroAlt, retroButtons, retroText, type RetroActions } from './retro/text'
import { replayText } from './replay/text'
import { replayAlt, replaySvg } from './replay/svg'
import { DETAILS_INITIAL, LIVE_INITIAL, RADIUS_INITIAL, SECTIONS_INITIAL, ciBox, askBox, guardBox, isOrcStateWrite, latestReplayView, retroBox, stepReplay, warmBox } from './state'

// State refs: literals in this file, as the engine's scan requires.
const SNAPSHOT_REF = { plugin: 'orc', key: 'snapshot' } as const
const SECTIONS_REF = { plugin: 'orc', key: 'sections' } as const
const LIVE_REF = { plugin: 'orc', key: 'live' } as const
const DETAILS_REF = { plugin: 'orc', key: 'details' } as const
const LEDGER_REF = { plugin: 'orc', key: 'ledger' } as const
const TOUCHED_REF = { plugin: 'orc', key: 'touched' } as const
const RADIUS_REF = { plugin: 'orc', key: 'radius' } as const
const REPLAY_REF = { plugin: 'orc', key: 'replay' } as const
const REPLAY_PANE = 'orc-replay'

let alertsSound = false

export function register(on: On, options: PluginOptions) {
  if (options.mod_enabled === false) return
  alertsSound = options.alerts_sound === true
  const features = parseFeatures(options)
  register_session(on, features)
  register_attribution(on)
  register_compaction(on)
  register_agents(on, parseProfile(options.model_profile))
  register_step_tool(on)
  register_touched(on, features)
  register_replay_close(on)
  register_refresh(on, features)
  register_cockpit(on, parseProfile(options.model_profile), features)
  register_surfaces(on)
  register_toolrows(on)
  register_gates(on)
  register_ask(on)
  register_band(on, features)
  register_steps(on, features)
  register_prompt(on, features)
  register_compose(on, features)
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
function register_session(on: On, features: Features) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'orc', description: 'orc cockpit — phase, slices, QA, PR, agents, decisions (no model turn)', immediate: true })
    } catch {
      // name taken in this build: the markdown /orc:status stays the fallback
    }
    gitFacts = null
    retroBox.dir = null
    retroBox.file = null
    // The step tool: orc subagents label their TDD steps for the progress view.
    try {
      await $.tool.register({ name: 'step', description: STEP_DESC, inputSchema: STEP_SCHEMA })
    } catch {
      // tools can't register in this build: agents just don't report steps
    }
    void refresh($).catch(() => undefined)
    if (retroOn(features)) void retro_load($).then(f => { retroBox.file = f; $.ui.invalidate('ui.render') }).catch(() => undefined)
    if (e.isInteractive) {
      $.clock.every(POLL_MS, () => { void ci_tick($) })
      if (features.cacheCliff === 'warn') $.clock.every(60_000, () => { void cache_tick($, features) })
    }
    await keepwarm_resume($, features).catch(() => undefined)
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
function register_refresh(on: On, features: Features) {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    // 2.1.291 types the Bash call flat (`e.command`); older builds nested it under `input`.
    const call = e as { command?: string; input?: { command?: string } }
    const command = call.command ?? call.input?.command ?? ''
    // Measured before the floor's dialog opens, so its notices can attach to it; never denies.
    const measured = features.guardMeasure ? await guard_measure($, command) : null
    const pending = next(e)
    void pending.catch(() => undefined)
    if (measured) {
      const clear = () => { guardBox.current = null; $.ui.invalidate('ui.render') }
      next.signal?.addEventListener('abort', clear)
      guardBox.current = measured
      $.ui.invalidate('ui.render')
      for (const line of measured.lines) { try { $.ui.notice(e.tool_use_id, line) } catch { /* a notice never fails the call */ } }
      try {
        const result = await pending
        clear()
        return after_bash($, command, result)
      } catch (err) {
        clear()
        throw err
      }
    }
    return after_bash($, command, await pending)
  })
}

async function after_bash($: EngineInterface, command: string, result: unknown) {
  if (isOrcStateWrite(command)) await refresh($).catch(() => undefined)
  if (GIT_COMMIT.test(command) && !failed(result)) await commit_touched($)
  return result
}

// The read-only measure for a command the shell floor will confirm; null when
// it is not one of those, or anything about measuring fails.
async function guard_measure($: EngineInterface, command: string): Promise<{ summary: GuardSummary; lines: string[] } | null> {
  try {
    const hit = classify(command)
    if (!hit || hit.cwd === '-') return null
    const outputs: string[] = []
    for (const argv of measurePlan(hit.kind, hit.args)) {
      const scoped = hit.cwd ? [argv[0], '-C', hit.cwd, ...argv.slice(1)] : argv
      const r = await $.process.run(scoped, { timeoutMs: 5000 })
      if (r.exitCode !== 0) return null
      outputs.push(r.stdout)
    }
    if (!outputs.length) return null
    const summary = summarize(hit.kind, outputs, hit.args)
    const lines = guardText(summary)
    const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
    const slice = snap.session ? currentSlice(snap.slices) : null
    const t = (await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL
    if (slice && t.sliceId === slice.id && t.files.some(f => f.kind === 'edit')) lines.push(`slice ${slice.id} has edits not yet checkpointed`)
    return { summary, lines }
  } catch {
    return null
  }
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
      retroBox.prev = String(e.answer ?? '')
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

function register_touched(on: On, features: Features) {
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

  // The shared edit observer: each step runs after a successful edit (touch, then record).
  on('tool.call', { tool: ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'] }, async ($, e, next) => {
    // A Write replaces the whole file, so the old content is read before the write runs.
    const before = features.replay ? await replay_before($, e) : null
    const result = await next(e)
    if (failed(result)) return result
    const call = e as { file_path?: string; notebook_path?: string }
    await touch_files($, [call.file_path ?? call.notebook_path ?? ''].filter(Boolean), 'edit')
    if (features.replay) await record_edit($, e, before)
    return result
  })
}

// --- Slice replay ------------------------------------------------------------
type EditCall = { tool?: string; file_path?: string; old_string?: string; new_string?: string; content?: string; edits?: { old_string?: string; new_string?: string }[] }

async function replay_before($: EngineInterface, e: unknown): Promise<string | null> {
  const call = e as EditCall
  if (call.tool !== 'Write' || !call.file_path) return null
  return $.fs.read(call.file_path).then(t => (typeof t === 'string' ? t : ''), () => '')
}

async function record_edit($: EngineInterface, e: unknown, before: string | null): Promise<void> {
  try {
    const call = e as EditCall
    let old: string, now: string
    if (call.tool === 'Edit') { old = call.old_string ?? ''; now = call.new_string ?? '' }
    else if (call.tool === 'MultiEdit') { old = (call.edits ?? []).map(x => x.old_string ?? '').join('\n'); now = (call.edits ?? []).map(x => x.new_string ?? '').join('\n') }
    else if (call.tool === 'Write') { old = before ?? ''; now = call.content ?? '' }
    else return
    if (!call.file_path) return
    const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
    const slice = snap.session ? currentSlice(snap.slices) : null
    const sliceId = slice ? Number(slice.id) : NaN
    if (!Number.isFinite(sliceId)) return
    const { root } = await git_facts($)
    const at = await $.clock.now()
    const cur = (await $.state.get(REPLAY_REF)).value ?? REPLAY_INITIAL
    await $.state.set(REPLAY_REF, recordEdit(cur, { sliceId, path: relPath(call.file_path, root), tool: call.tool, old, new: now, at }))
  } catch { /* bookkeeping never fails a tool call */ }
}

const replay_state = ($: EngineInterface) => $.state.get(REPLAY_REF).then(r => r.value ?? REPLAY_INITIAL, () => REPLAY_INITIAL)

// Open the replay pane at the latest slice. False when nothing is recorded or the pane was refused.
async function open_replay($: EngineInterface): Promise<boolean> {
  const cur = await replay_state($)
  if (!cur.edits.length) return false
  await $.state.set(REPLAY_REF, { ...cur, view: latestReplayView(cur) })
  try {
    if (!(await $.ui.open({ id: REPLAY_PANE, title: 'replay', focus: true, closeOnEscape: true, rows: 18, columns: 64 })).isPlaced) return false
  } catch {
    return false
  }
  await $.ui.focus({ requestId: REPLAY_PANE, key: 'replay-next' }).catch(() => undefined)
  return true
}

async function replay_command($: EngineInterface, features: Features): Promise<{ text?: string }> {
  if (!features.replay) return { text: 'Slice replay is off (replay option).' }
  const cur = await replay_state($)
  const v = replayView(cur, latestReplayView(cur))
  if (!v) return { text: 'No edits recorded yet in this session.' }
  if ((await $.session.surfaces()).length && (await open_replay($))) return {}
  return { text: `Slice ${v.sliceId} · ${v.tool} ${v.path} +${v.add} -${v.del}\n${v.diff}` }
}

function draw_replay($: EngineInterface, e: { surface: RenderSurface | null; props: { bodyColumns: number } }, els: Els, state: ReplayState) {
  const { Box, Text, Button } = els
  const v = replayView(state, state.view)
  const walk = (delta: 1 | -1) => async () => {
    try {
      const cur = await replay_state($)
      await $.state.set(REPLAY_REF, { ...cur, view: stepReplay(cur, delta) })
    } catch { /* the view stays as drawn */ }
  }
  const buttons = Box({ flexDirection: 'row', columnGap: 2, children: [
    Button({ key: 'replay-prev', hotkey: 'p', label: '◀ Prev', onPress: walk(-1) }),
    Button({ key: 'replay-next', hotkey: 'n', label: 'Next ▶', onPress: walk(1) }),
    Button({ key: 'replay-close', hotkey: 'c', role: 'dismiss', label: 'Close', onPress: async () => { await $.ui.close({ id: REPLAY_PANE }).catch(() => undefined); await reset_replay($) } }),
  ] })
  if (!v) return Box({ flexDirection: 'column', children: [Text({ dimColor: true, children: ['No edits recorded yet'] }), buttons] })
  const source = isRich(e.surface) && 'Svg' in els ? replaySvg(v, e.props.bodyColumns) : null
  const body = source && 'Svg' in els ? els.Svg({ source, alt: replayAlt(v), width: px(e.props.bodyColumns) }) : replayText(els, v)
  return Box({ flexDirection: 'column', children: [body, buttons] })
}

async function reset_replay($: EngineInterface): Promise<void> {
  try { await $.state.set(REPLAY_REF, { ...(await replay_state($)), view: REPLAY_INITIAL.view }) } catch { /* ignore */ }
}

// Closing the pane rewinds the view. The hook hears the person's close (Escape, close key); a plugin's own
// $.ui.close skips its own hooks, so the Close button resets directly.
function register_replay_close(on: On) {
  on('ui.close', { id: REPLAY_PANE }, async ($, e, next) => {
    const result = await next(e)
    if (!failed(result)) await reset_replay($)
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
      // A request that re-wrote the cache starts the clock over (the ping clock too).
      if (!e.agentId && result?.usage && isColdRewrite(cur.main.lastContext, result.usage)) warmBox.pingedAt = null
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

// The dialog stays open for as long as the tool call is pending; the cache row reads it as "waiting on your answer".
function register_ask(on: On) {
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      askBox.open = false
      $.ui.invalidate('ui.render')
    }
  })
}

// Gate chrome: outward and escalation gates (orc:gates header chips) get a
// badge above the engine's own dialog, which is kept exactly once.
function register_gates(on: On) {
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    askBox.open = true
    const badge = gateBadge(e.props.questions)
    if (!badge) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return Box({ flexDirection: 'column', children: [Text({ bold: true, color: 'yellow', children: [badge] }), await next(e)] })
  })
}

// --- Cache cliff and keep-warm -------------------------------------------------
// The prompt cache lapses after the ttl without a request. The clock reads the main loop's last
// request from the ledger (a keep-warm ping moves it forward); the band warns in the last 15 minutes,
// a composer send past the ttl toasts what it will re-write, and /orc keepwarm pings to hold it.
type CacheClock = CacheView & { lastAt: number }

async function cache_view($: EngineInterface, features: Features): Promise<CacheClock | null> {
  const main = ((await $.state.get(LEDGER_REF)).value ?? LEDGER_INITIAL).main
  const lastAt = Math.max(main.lastAt ?? 0, warmBox.pingedAt ?? 0)
  if (!lastAt || main.lastContext <= 0 || !main.model) return null
  const now = await $.clock.now()
  return { ...cacheState({ lastAt, lastContext: main.lastContext, model: main.model, now, ttlMs: features.cacheTtlMs }), lastAt }
}

async function cache_row($: EngineInterface, features: Features, idle: boolean): Promise<BandRow | null> {
  if (features.cacheCliff !== 'warn' || !(idle || askBox.open)) return null
  try {
    const v = await cache_view($, features)
    if (!v || v.phase !== 'cooling') return null
    return { kind: 'cache', minutesLeft: v.minutesLeft, rewriteUsd: v.rewriteUsd, tokens: v.tokens, waitingOn: askBox.open ? 'your answer' : null }
  } catch {
    return null
  }
}

// The prompt.submit step that warns before a send re-writes a cold cache. Never blocks or alters the prompt.
async function cache_cold_toast($: EngineInterface, e: { origin: { kind: string } }, features: Features): Promise<void> {
  if (features.cacheCliff !== 'warn' || e.origin.kind !== 'composer') return
  try {
    const v = await cache_view($, features)
    if (v && v.phase === 'cold' && v.coldFor > 0 && v.tokens > COLD_MIN_TOKENS) $.ui.toast(coldToast(v.coldFor, v.tokens, v.rewriteUsd))
  } catch { /* a warning never fails a send */ }
}

// The only prompt.submit hook; each step may inspect the prompt, none may drop it.
function register_prompt(on: On, features: Features) {
  on('prompt.submit', async ($, e, next) => {
    await cache_cold_toast($, e, features)
    const kept = next(e)
    retro_defer($, e, features)
    return kept
  })
}

// --- Corrections -> retro store -------------------------------------------------
// A composer prompt that reads like a correction is checked by Haiku after the send went through; the rule it
// proposes becomes a candidate in <state root>/retro/candidates.json. Saved rules (rules.md) reach later sessions
// through prompt.compose. $.fs.write creates parent directories, so no mkdir.
const retroOn = (features: Features) => features.corrections && !companions.reflect

function retro_defer($: EngineInterface, e: { text: string; origin: { kind: string } }, features: Features): void {
  if (!retroOn(features) || e.origin.kind !== 'composer' || !mayBeCorrection(e.text)) return
  const text = e.text, prev = retroBox.prev
  $.clock.after(0, () => { void retro_drain($, text, prev).catch(() => undefined) })
}

async function retro_dir($: EngineInterface): Promise<string> {
  if (retroBox.dir) return retroBox.dir
  const env = await $.env.get('ORC_STATE_DIR').catch(() => undefined)
  const root = env ? '' : (await git_facts($)).root
  const dir = (env || (root ? root + '/.orc' : '.orc')) + '/retro'
  if (env || root) retroBox.dir = dir
  return dir
}

async function retro_read($: EngineInterface, name: string): Promise<string> {
  return $.fs.read((await retro_dir($)) + '/' + name).then(t => (typeof t === 'string' ? t : ''), () => '')
}

async function retro_load($: EngineInterface): Promise<CandidateFile> {
  try {
    const f = JSON.parse(await retro_read($, 'candidates.json')) as CandidateFile
    if (f.schema === 1 && Array.isArray(f.items)) return f
  } catch { /* missing or unreadable: start empty */ }
  return { schema: 1, items: [] }
}

// Writes run one at a time, each re-reading the file first, so two checks finishing together both land.
function retro_serial<T>(job: () => Promise<T>): Promise<T> {
  const run = retroBox.chain.then(job)
  retroBox.chain = run.catch(() => undefined)
  return run
}

async function retro_put($: EngineInterface, file: CandidateFile): Promise<void> {
  await $.fs.write((await retro_dir($)) + '/candidates.json', JSON.stringify(file, null, 2) + '\n')
  retroBox.file = file
  $.ui.invalidate('ui.render')
}

async function retro_drain($: EngineInterface, text: string, prev: string): Promise<void> {
  const r = await $.model.complete({ model: HAIKU, maxTokens: 300, system: RETRO_SYSTEM, prompt: retroPrompt(text, prev) })
  if (!r.isAnswered) return
  const v = parseRetro(r.text)
  const rule = v && v.isCorrection && v.confidence >= 0.7 ? cleanRule(v.rule) : undefined
  if (!rule) return
  const at = await $.clock.now()
  await retro_serial(async () => {
    const f = await retro_load($)
    const m = mergeCandidate(f.items, rule, { source: 'composer', at, saved: f.items.filter(i => i.status === 'saved').map(i => i.rule) })
    if (!m.alreadySaved) await retro_put($, { schema: 1, items: m.items })
  })
}

// Save a clean rule: mark its candidate saved (the card's id, else the closest one, else a new one) and splice rules.md.
async function retro_save($: EngineInterface, raw: string, id?: string): Promise<string> {
  const clean = cleanRule(raw)
  if (!clean) return 'Rule not saved: it must be one line, under 200 characters, with no secrets.'
  try {
    return await retro_serial(async () => {
      const f = await retro_load($)
      const at = await $.clock.now()
      let items = f.items
      let hit = id ? items.findIndex(i => i.id === id) : -1
      if (hit < 0) {
        // The closest candidate (no seen bump: this is the person deciding), else a new one.
        hit = items.reduce((best, c, i) => (similarity(c.rule, clean) > (best < 0 ? 0 : similarity(items[best].rule, clean)) ? i : best), -1)
        if (hit < 0 || similarity(items[hit].rule, clean) < 0.6) { items = mergeCandidate(items, clean, { source: 'manual', at }).items; hit = items.length - 1 }
      }
      items = items.map((c, i) => (i === hit ? { ...c, rule: clean, status: 'saved' as const, at } : c))
      const current = await retro_read($, 'rules.md')
      // Bullets already in rules.md (typed by hand, or saved from another checkout) stay.
      const rules = [...new Set([...savedRules(current), ...items.filter(i => i.status === 'saved').map(i => i.rule)])]
      const out = current.trim() === '' ? renderRules(rules) : spliceRules(current, rules)
      if (out === undefined) return 'Rule not saved: rules.md has no single orc:retro start/end markers, in that order. Fix or remove the file.'
      await $.fs.write((await retro_dir($)) + '/rules.md', out)
      await retro_put($, { schema: 1, items })
      return 'Saved rule: ' + clean
    })
  } catch {
    return 'Rule not saved: the retro files could not be written.'
  }
}

async function retro_skip($: EngineInterface, id: string): Promise<void> {
  await retro_serial(async () => {
    const f = await retro_load($)
    await retro_put($, { schema: 1, items: f.items.map(i => (i.id === id ? { ...i, status: 'skipped' as const } : i)) })
  })
}

async function retro_command($: EngineInterface, arg: string): Promise<{ text: string }> {
  const save = arg.match(/^save\s+([\s\S]+)$/)
  if (save) return { text: await retro_save($, save[1].trim().replace(/^"([\s\S]*)"$/, '$1')) }
  const items = (await retro_load($)).items
  const pending = items.filter(i => i.status === 'pending'), saved = items.filter(i => i.status === 'saved')
  if (!pending.length && !saved.length) return { text: 'No retro candidates yet. Usage: /orc retro save "<rule>"' }
  return { text: [
    ...(pending.length ? [`${pending.length} pending:`, ...pending.map(i => `- "${i.rule}" · seen ${i.seen}×`)] : []),
    ...(saved.length ? ['Saved:', ...saved.map(i => '- ' + i.rule)] : []),
  ].join('\n') }
}

// Drawing reads the cached candidates only (loaded at session.start, kept current by every write): no IO per render.
const retro_pending_items = (features: Features) => (retroOn(features) ? (retroBox.file?.items ?? []).filter(i => i.status === 'pending') : [])

function retro_row(features: Features): BandRow | null {
  const top = retro_pending_items(features).sort((a, b) => b.at - a.at)[0]
  return top ? { kind: 'retro', id: top.id, rule: top.rule, seen: top.seen } : null
}

// Saved rules join the system prompt as one session section (after any shared ones), capped at 2,000 chars.
function register_compose(on: On, features: Features) {
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if (!retroOn(features)) return result
    try {
      const text = rulesSection(savedRules(await retro_read($, 'rules.md')))
      return text ? { sections: [...result.sections, { id: 'orc:retro-rules', text, scope: 'session' as const }] } : result
    } catch {
      return result
    }
  })
}

// Once a minute: redraw the band only when what it says would change.
let lastCacheSig = ''
async function cache_tick($: EngineInterface, features: Features): Promise<void> {
  try {
    const v = await cache_view($, features)
    const sig = v && v.phase === 'cooling' ? 'cooling:' + v.minutesLeft : v ? v.phase : ''
    if (sig === lastCacheSig) return
    lastCacheSig = sig
    $.ui.invalidate('ui.render')
  } catch { /* the next tick tries again */ }
}

const keepwarmKey = (sid: string) => 'keepwarm:' + sid

function keepwarm_schedule($: EngineInterface, features: Features, gen: number, delay: number): void {
  warmBox.timer = $.clock.after(delay, () => { void keepwarm_ping($, features, gen).catch(() => undefined) })
}

async function keepwarm_arm($: EngineInterface, features: Features, deadline: number, persist: boolean): Promise<void> {
  warmBox.timer?.cancel()
  const gen = ++warmBox.gen
  warmBox.deadline = deadline
  if (persist) await $.store.set(keepwarmKey(await $.session.id()), deadline).catch(() => undefined)
  const every = pingEvery(features.cacheTtlMs)
  // The first ping is due `every` after the cache was last touched, not after the command.
  const v = await cache_view($, features).catch(() => null)
  const now = await $.clock.now()
  keepwarm_schedule($, features, gen, v && v.phase !== 'cold' ? Math.min(every, Math.max(5_000, v.lastAt + every - now)) : every)
  $.ui.invalidate('ui.render')
}

async function keepwarm_stop($: EngineInterface, why: string | null): Promise<void> {
  warmBox.gen++
  warmBox.timer?.cancel()
  warmBox.timer = null
  warmBox.deadline = null
  await $.store.set(keepwarmKey(await $.session.id()), null).catch(() => undefined)
  if (why) $.ui.toast(why)
  $.ui.invalidate('ui.render')
}

async function keepwarm_ping($: EngineInterface, features: Features, gen: number): Promise<void> {
  if (gen !== warmBox.gen) return
  const now = await $.clock.now()
  if (warmBox.deadline == null || now >= warmBox.deadline) return keepwarm_stop($, 'keep-warm finished')
  const every = pingEvery(features.cacheTtlMs)
  // The user is active: their own requests keep the cache warm, so wait out the rest of the interval.
  const v = await cache_view($, features)
  if (v && now - v.lastAt < every - 5_000) { keepwarm_schedule($, features, gen, v.lastAt + every - now); return }
  const r = await $.model.fork({ prompt: 'Reply with the single word: warm' }).catch(() => null)
  if (gen !== warmBox.gen) return
  if (!r || !r.isAnswered) return keepwarm_stop($, 'keep-warm stopped: ' + (r ? 'nothing to keep warm yet' : 'the ping failed'))
  if (pingGone(r.usage)) return keepwarm_stop($, 'keep-warm stopped: the cache was already gone')
  warmBox.pingedAt = await $.clock.now()
  if (warmBox.pingedAt + every >= warmBox.deadline) return keepwarm_stop($, 'keep-warm finished')
  keepwarm_schedule($, features, gen, every)
}

// A hot reload cancels pending timers; the deadline in $.store re-arms them.
async function keepwarm_resume($: EngineInterface, features: Features): Promise<void> {
  const deadline = await $.store.get(keepwarmKey(await $.session.id()))
  if (typeof deadline === 'number' && deadline > (await $.clock.now())) await keepwarm_arm($, features, deadline, false)
}

async function keepwarm_command($: EngineInterface, features: Features, arg: string): Promise<{ text: string }> {
  if (arg === 'off') {
    await keepwarm_stop($, null)
    return { text: 'Keep-warm off.' }
  }
  if (arg === '') return { text: warmBox.deadline == null ? 'Keep-warm is off. Usage: /orc keepwarm <2h|90m|off>' : `Keep-warm is on for ${Math.max(1, Math.round((warmBox.deadline - (await $.clock.now())) / 60_000))} more minutes.` }
  const ms = parseDuration(arg)
  if (ms == null) return { text: 'Usage: /orc keepwarm <2h|90m|1h30m|off>' }
  await keepwarm_arm($, features, (await $.clock.now()) + ms, true)
  return { text: `Keep-warm on for ${arg}: a one-word ping about every ${Math.round(pingEvery(features.cacheTtlMs) / 60_000)} minutes keeps the prompt cache warm (cache reads, not re-writes).` }
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
    const progress = features.progressBand ? await progress_row($, features) : null
    const guard: BandRow | null = guardBox.current ? { kind: 'guard', summary: guardBox.current.summary.headline, detail: guardBox.current.summary } : null
    const retro = retro_row(features)
    const cache = await cache_row($, features, !e.props.isWorking)
    // the sentinel row joins here in slice 21
    const row = pickBand([ci, guard, retro, cache, progress])
    if (!row) return next(e)
    const below = await next(e)
    const els = $.ui.resolve(e)
    const mine = draw_band_row($, e, els, row)
    return els.Box({ flexDirection: 'column', children: [mine, below] })
  })
}

async function progress_row($: EngineInterface, features: Features): Promise<BandRow | null> {
  const snap = await $.state.get(SNAPSHOT_REF).then(r => r.value ?? EMPTY, () => EMPTY)
  const ledger = await $.state.get(LEDGER_REF).then(r => r.value ?? LEDGER_INITIAL, () => LEDGER_INITIAL)
  const model = progressModel(snap, ledger)
  if (!model) return null
  const replay = features.replay && model.phase >= 6 && (await replay_state($)).edits.length > 0
  return { kind: 'progress', model, ...(replay ? { replay } : {}) }
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
  if (row.kind === 'guard') {
    const source = row.detail && isRich(e.surface) && 'Svg' in els ? guardSvg(row.detail, e.props.bodyColumns) : null
    return source && 'Svg' in els
      ? els.Svg({ source, alt: row.summary, width: px(e.props.bodyColumns) })
      : els.Text({ color: 'yellow', children: ['⚠ ' + row.summary] })
  }
  if (row.kind === 'cache') {
    const warm = warmBox.deadline == null ? () => { $.prompt.fill({ text: '/orc keepwarm 1h' }).catch(() => undefined) } : null
    const source = isRich(e.surface) && 'Svg' in els ? fitSvg(cacheSvg(row, px(e.props.bodyColumns))) : null
    if (source && 'Svg' in els) {
      return els.Box({ flexDirection: 'row', columnGap: 2, children: [
        els.Svg({ source, alt: cacheAlt(row), height: 28 }),
        ...(warm ? [els.Button({ key: 'cache-warm', label: 'Keep warm', onPress: warm })] : []),
      ] })
    }
    return cacheText(els, row, warm)
  }
  if (row.kind === 'retro') {
    const actions: RetroActions = {
      save: () => { void retro_save($, row.rule, row.id).then(m => $.ui.toast(m)).catch(() => undefined) },
      edit: () => { $.prompt.fill({ text: `/orc retro save "${row.rule}"` }).catch(() => undefined) },
      skip: () => { void retro_skip($, row.id).catch(() => undefined) },
    }
    const source = isRich(e.surface) && 'Svg' in els ? fitSvg(retroSvg(row, px(e.props.bodyColumns))) : null
    if (source && 'Svg' in els) return els.Box({ flexDirection: 'row', columnGap: 2, children: [els.Svg({ source, alt: retroAlt(row), height: 28 }), ...retroButtons(els, actions)] })
    return retroText(els, row, actions)
  }
  if (row.kind === 'progress') {
    const m = row.model
    const next = m.next
    const go = next ? [els.Button({ key: 'orc-next', hotkey: '1', label: next, onPress: () => { $.prompt.fill({ text: next }).catch(() => undefined) } })] : []
    const source = isRich(e.surface) && 'Svg' in els ? fitSvg(progressSvg(m, px(e.props.bodyColumns))) : null
    const drawn = source && 'Svg' in els
      ? els.Svg({ source, alt: progressAlt(m), height: 28 })
      : els.Text({ children: [progressText(m, e.props.bodyColumns)] })
    const again = row.replay ? [els.Button({ key: 'orc-replay', hotkey: 'r', label: 'Replay', onPress: () => { open_replay($).catch(() => undefined) } })] : []
    return els.Box({ flexDirection: 'row', columnGap: 2, children: [drawn, ...go, ...again] })
  }
  return els.Text({ children: [] })
}

// --- /orc cockpit -----------------------------------------------------------
// A dashboard pane drawn from $.state, no model turn: header strip, phase
// ladder beside the slice ledger. Where nothing can draw (VS Code, claude -p)
// it answers with a text summary.
function register_cockpit(on: On, fallbackProfile: Profile, features: Features) {
  on('command.run', { command: 'orc' }, async ($, e) => {
    await refresh($).catch(() => undefined)
    if (e.args.trim() === 'replay') return replay_command($, features)
    if (/^keepwarm(\s|$)/.test(e.args.trim())) return keepwarm_command($, features, e.args.trim().slice(8).trim())
    if (/^retro(\s|$)/.test(e.args.trim())) return retro_command($, e.args.trim().slice(5).trim())
    // `/orc radius` opens the cockpit with the ship-radius section already expanded.
    if (e.args.trim() === 'radius') {
      try {
        await $.state.set(SECTIONS_REF, { ...((await $.state.get(SECTIONS_REF)).value ?? SECTIONS_INITIAL), radius: true })
        await load_details($, 'radius')
      } catch { /* the pane opens with the section as it was */ }
    }
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
    if (e.requestId === REPLAY_PANE) return draw_replay($, e, $.ui.resolve(e), await replay_state($))
    if (e.requestId !== PANE) return next(e)
    const snap = (await $.state.get(SNAPSHOT_REF)).value ?? EMPTY
    const sections = (await $.state.get(SECTIONS_REF)).value ?? SECTIONS_INITIAL
    const details = (await $.state.get(DETAILS_REF)).value ?? DETAILS_INITIAL
    const ledger = (await $.state.get(LEDGER_REF)).value ?? LEDGER_INITIAL
    const now = await $.clock.now().catch(() => 0)
    const agents = agentRows(ledger, costOf, now)
    const radius = (await $.state.get(RADIUS_REF)).value ?? RADIUS_INITIAL
    const touched = touchedRows((await $.state.get(TOUCHED_REF)).value ?? TOUCHED_INITIAL, now)
    const shotMode = pixelTerminal(await $.env.get('TERM_PROGRAM').catch(() => undefined), await $.env.get('KITTY_WINDOW_ID').catch(() => undefined)) ? 'image' as const : 'raster' as const
    const model = { snap, sections, details, agents, touched, radius, shotMode, retroPending: retro_pending_items(features).length, rich: isRich(e.surface), ciAlert: ciBox.alert, profile: profileOf(snap, fallbackProfile), placement: e.props.placement, bodyColumns: e.props.bodyColumns }
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
      openTarget: (url: string) => { open_target($, url).catch(() => undefined) },
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
      if (!open.digest && !open.diff && !open.qa) await $.state.set(DETAILS_REF, DETAILS_INITIAL)
      if (open.digest) await load_details($, 'digest')
      if (open.diff) await load_details($, 'diff')
      if (open.radius) await load_details($, 'radius')
      if (open.qa) await load_details($, 'qa')
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
  if (id === 'radius') await load_radius($)
  if (id === 'qa') await load_qa($)
}

// QA thumbnails: `orc-report thumbs` writes them beside the packet; read the jpg (desktop embeds it) and the rgb (terminal Raster).
async function load_qa($: EngineInterface): Promise<void> {
  const out = await $.process.run([$.plugin.root + '/bin/orc-report', 'thumbs'], { timeoutMs: 20000 }).then(r => (r.exitCode === 0 ? r.stdout : ''), () => '')
  const b64 = (path: string | null) => path ? $.fs.read(path, { as: 'bytes' }).then(r => r.base64, () => null) : Promise.resolve(null)
  const shots = await Promise.all(parseThumbs(out).map(async t => ({ name: t.name, criterion: t.criterion, jpg: t.jpg, png: t.png, b64: await b64(t.jpg), rgb: await b64(t.rgb) })))
  const d = (await $.state.get(DETAILS_REF)).value ?? DETAILS_INITIAL
  await $.state.set(DETAILS_REF, { ...d, shots })
}

// "Open target": the terminal-browser companion's /browser command, else the OS opener (darwin: open, otherwise xdg-open).
async function open_target($: EngineInterface, url: string): Promise<void> {
  const uname = await $.process.run(['uname', '-s'], { timeoutMs: 3000 }).then(r => r.stdout, () => '')
  const plan = openPlan(url, companions.terminalBrowser, uname)
  if (!plan) return $.ui.toast('No http(s) target to open')
  if ('command' in plan) await $.command.run(plan.command)
  else await $.process.run(plan.argv, { timeoutMs: 5000 })
}

// Ship radius, read when its section opens: size against budget, the changed files, and
// (only when a Graphify graph answers) the other nodes that depend on them.
async function load_radius($: EngineInterface): Promise<void> {
  const g = await git_facts($)
  const cwd = g.root || undefined
  const run = (argv: string[]) => $.process.run(argv, { timeoutMs: 10000, ...(cwd ? { cwd } : {}) }).then(r => (r.exitCode === 0 ? r.stdout : null), () => null)
  const bin = $.plugin.root + '/bin/orc-pr-size'
  const [loc, budget, names] = await Promise.all([run([bin, 'loc']), run([bin, 'budget']), run(['git', 'diff', '--name-only', g.mergeBase + '...HEAD'])])
  const files = parseNames(names ?? '')
  const size = Number(loc), cap = Number(budget)
  if (loc == null || budget == null || !Number.isFinite(size) || !(cap > 0)) {
    await $.state.set(RADIUS_REF, { loc: 0, budget: 0, files: files.length, dependents: null })
    return
  }
  let dependents: number | null = null
  const probe = files.length ? await run(['graphify', 'affected', files[0], '--depth', '1']) : null
  if (probe != null) {
    const rest = await Promise.all(files.slice(1, MAX_PROBED).map(f => run(['graphify', 'affected', f, '--depth', '1'])))
    dependents = countDependents([probe, ...rest].map(o => parseAffected(o ?? '')), files)
  }
  await $.state.set(RADIUS_REF, { loc: size, budget: cap, files: files.length, dependents })
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
