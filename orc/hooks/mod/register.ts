// The orc mod: in-process event hooks layered on top of orc's bash settings
// hooks, which stay the safety floor. Nothing here replaces a guard — when
// mods can't load (Claude Code < 2.1.287, --safe-mode, disableAllHooks, an
// org policy) or `mod_enabled` is false, orc behaves exactly as without it.
import type { EngineInterface, On, PluginOptions } from 'claude-code'
import { LEASE_MS, POLL_MS, SETTLED_MS, alertFor, mayPoll, signature, statusLine, summarizeChecks, type CiRecord } from './ci'
import {
  EMPTY, currentSlice, cutDiff, digestOf, hintFor, parseDecisions, parseMeter, parseReport, parseSession, parseSize, parseSlices, parseUsage, plumbingLine, policyOf, profileOf, spinnerSuffix, summaryText, type SectionId, type Snapshot,
} from './cockpit'
import { gateBadge } from './gates'
import { PANE, drawPane } from './pane'
import { modelFor, parseProfile, type Profile } from './profiles'
import { DETAILS_INITIAL, LIVE_INITIAL, SECTIONS_INITIAL, ciBox, isOrcStateWrite } from './state'

// State refs: literals in this file, as the engine's scan requires.
const SNAPSHOT_REF = { plugin: 'orc', key: 'snapshot' } as const
const SECTIONS_REF = { plugin: 'orc', key: 'sections' } as const
const LIVE_REF = { plugin: 'orc', key: 'live' } as const
const DETAILS_REF = { plugin: 'orc', key: 'details' } as const

let alertsSound = false

export function register(on: On, options: PluginOptions) {
  if (options.mod_enabled === false) return
  alertsSound = options.alerts_sound === true
  register_session(on)
  register_attribution(on)
  register_compaction(on)
  register_agents(on, parseProfile(options.model_profile))
  register_refresh(on)
  register_cockpit(on, parseProfile(options.model_profile))
  register_surfaces(on)
  register_toolrows(on)
  register_gates(on)
  register_ci_band(on)
}

// One session.start hook: add /orc, and in an interactive session start the CI watcher.
function register_session(on: On) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'orc', description: 'orc cockpit — phase, slices, QA, PR, agents, decisions (no model turn)', immediate: true })
    } catch {
      // name taken in this build: the markdown /orc:status stays the fallback
    }
    void refresh($)
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
    const command = (e.input as { command?: string }).command ?? ''
    if (isOrcStateWrite(command)) await refresh($).catch(() => undefined)
    return result
  })
}

// orc agents: model_profile picks the model when the Agent call named none
// (never over an explicit one — an escalation step-up), and every finished orc
// subagent run lands in the usage ledger (`orc-state usage add`) — the data the
// routing is re-tuned from.
const agentTypes = new Map<string, string>()

function register_agents(on: On, profile: Profile) {
  on('agent.spawn', async ($, e, next) => {
    const snap = (await $.state.get(SNAPSHOT_REF)).value ?? EMPTY
    const model = e.model ? undefined : modelFor(profileOf(snap, profile), e.subagentType)
    const result = await next(model ? { ...e, model } : e)
    if (result.agentId && /^(orc:)?orc-/.test(e.subagentType)) {
      agentTypes.set(result.agentId, e.subagentType.replace(/^orc:/, ''))
      await $.state.set(LIVE_REF, { agent: e.subagentType.replace(/^orc:/, ''), since: await $.clock.now() })
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await refresh($)
    const agent = e.agentId ? agentTypes.get(e.agentId) : undefined
    if (agent && e.usage) {
      agentTypes.delete(e.agentId as string)
      await $.state.set(LIVE_REF, LIVE_INITIAL)
      await orc_state($, ['usage', 'add', '--agent', agent, '--model', e.usage.model,
        '--in', String(e.usage.input_tokens), '--out', String(e.usage.output_tokens), '--ms', String(e.durationMs)])
    }
    return result
  })
}

// orc outside the pane: the spinner's suffix, the idle prompt hint and the mode
// footer. Each is a prop rewrite; the engine keeps drawing its own line.
function register_surfaces(on: On) {
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const snap = (await $.state.get(SNAPSHOT_REF)).value ?? EMPTY
    const live = (await $.state.get(LIVE_REF)).value ?? LIVE_INITIAL
    const suffix = spinnerSuffix(snap, live.agent)
    return suffix ? next({ ...e, props: { ...e.props, suffix: e.props.suffix + suffix } }) : next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.props.isWorking || e.props.isDraft) return next(e)
    const hint = hintFor((await $.state.get(SNAPSHOT_REF)).value ?? EMPTY)
    return hint ? next({ ...e, props: { ...e.props, hint } }) : next(e)
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const policy = policyOf((await $.state.get(SNAPSHOT_REF)).value ?? EMPTY)
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

// The band above the prompt carries the one actionable alert: red CI.
function register_ci_band(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!ciBox.alert) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const alert = ciBox.alert
    return Box({ flexDirection: 'row', columnGap: 2, children: [
      Text({ color: 'red', children: [`⛔ CI red on #${alert.pr}: ${alert.summary.failing.join(', ')}`] }),
      Button({ key: 'ci-diagnose', label: 'Diagnose', onPress: () => { $.prompt.fill({ text: '/orc:ci ' + alert.pr }) } }),
      Button({ key: 'ci-dismiss', label: 'Dismiss', onPress: () => { ciBox.alert = null; $.ui.invalidate('ui.render') } }),
      await next(e),
    ] })
  })
}

// --- /orc cockpit -----------------------------------------------------------
// A dashboard pane drawn from $.state, no model turn: header strip, phase
// ladder beside the slice ledger. Where nothing can draw (VS Code, claude -p)
// it answers with a text summary.
function register_cockpit(on: On, fallbackProfile: Profile) {
  on('command.run', { command: 'orc' }, async ($) => {
    await refresh($)
    const snap = (await $.state.get(SNAPSHOT_REF)).value ?? EMPTY
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
    const model = { snap, sections, details, ciAlert: ciBox.alert, profile: profileOf(snap, fallbackProfile), placement: e.props.placement, bodyColumns: e.props.bodyColumns }
    return drawPane($.ui.resolve(e), model, {
      resume: () => { $.prompt.fill({ text: snap.session ? '/orc:resume' : '/orc:flow ' }) },
      toggle: (id: SectionId) => async () => {
        const current = (await $.state.get(SECTIONS_REF)).value ?? SECTIONS_INITIAL
        await $.state.set(SECTIONS_REF, { ...current, [id]: !current[id] })
        if (current[id]) return
        if (id === 'digest') await load_digest($, snap)
        if (id === 'diff') await load_diff($, snap)
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
  const [session, slices, decisions, qa, loc, budget, usage, meter] = await Promise.all([
    run(['orc-state', 'get']), run(['orc-state', 'slice', 'list']), run(['orc-state', 'decision', 'get']), run(['orc-report', 'json']),
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
      const snap = await load_snapshot($)
      // Stale digests and diffs are worse than a reload: open sections reload on the next toggle.
      await $.state.set(DETAILS_REF, DETAILS_INITIAL)
      await $.state.set(SNAPSHOT_REF, snap)
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

// checkpoint.md's digest, read once per open; '' is drawn as "no digest".
async function load_digest($: EngineInterface, snap: Snapshot): Promise<void> {
  const branch = snap.session?.branch
  if (!branch) return
  const root = (await $.env.get('ORC_STATE_DIR').catch(() => undefined)) || '.orc'
  const text = await $.fs.read(`${root}/${branch}/files/checkpoint.md`).then(t => (typeof t === 'string' ? t : ''), () => '')
  const d = (await $.state.get(DETAILS_REF)).value ?? DETAILS_INITIAL
  await $.state.set(DETAILS_REF, { ...d, digest: digestOf(text) ?? '' })
}

// The current slice's diff: its commit when it has one, else the working tree.
async function load_diff($: EngineInterface, snap: Snapshot): Promise<void> {
  const cur = currentSlice(snap.slices)
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
