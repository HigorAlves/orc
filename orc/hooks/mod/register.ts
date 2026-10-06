// The orc mod: in-process event hooks layered on top of orc's bash settings
// hooks, which stay the safety floor. Nothing here replaces a guard — when
// mods can't load (Claude Code < 2.1.287, --safe-mode, disableAllHooks, an
// org policy) or `mod_enabled` is false, orc behaves exactly as without it.
import type { EngineInterface, On, PluginOptions } from 'claude-code'
import { LEASE_MS, POLL_MS, SETTLED_MS, alertFor, mayPoll, signature, statusLine, summarizeChecks, type CiRecord, type CiSummary } from './ci'
import {
  EMPTY, POLICIES, criterionLine, headline, isDone, parseDecisions, parseMeter, parseReport, parseSession, parseSize, parseSlices, parseUsage,
  phaseRows, policyOf, sizeLine, sliceLine, summaryText, usageLine, type Session, type Snapshot,
} from './cockpit'
import { isOrcStateWrite } from './state'

// State refs: literals in this file, as the engine's scan requires.
const SNAPSHOT_REF = { plugin: 'orc', key: 'snapshot' } as const
import { gateBadge } from './gates'
import { modelFor, parseProfile, type Profile } from './profiles'

let alertsSound = false

export function register(on: On, options: PluginOptions) {
  if (options.mod_enabled === false) return
  alertsSound = options.alerts_sound === true
  register_session(on)
  register_attribution(on)
  register_compaction(on)
  register_agents(on, parseProfile(options.model_profile))
  register_refresh(on)
  register_cockpit(on)
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
    const model = e.model ? undefined : modelFor(profile, e.subagentType)
    const result = await next(model ? { ...e, model } : e)
    if (result.agentId && /^(orc:)?orc-/.test(e.subagentType)) agentTypes.set(result.agentId, e.subagentType.replace(/^orc:/, ''))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await refresh($)
    const agent = e.agentId ? agentTypes.get(e.agentId) : undefined
    if (agent && e.usage) {
      agentTypes.delete(e.agentId as string)
      await orc_state($, ['usage', 'add', '--agent', agent, '--model', e.usage.model,
        '--in', String(e.usage.input_tokens), '--out', String(e.usage.output_tokens), '--ms', String(e.durationMs)])
    }
    return result
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
let ciAlert: { pr: number | string; summary: CiSummary } | null = null

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
        ciAlert = { pr: label, summary }
        $.ui.toast(`CI red on #${label}: ${summary.failing.join(', ')} — /orc:ci to diagnose`)
        await $.prompt.suggest({ text: '/orc:ci ' + label })
        if (alertsSound) await $.audio.play({ asset: 'hooks/mod/chime.wav' })
      } else if (kind === 'green') {
        ciAlert = null
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
    if (!ciAlert) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const alert = ciAlert
    return Box({ flexDirection: 'row', columnGap: 2, children: [
      Text({ color: 'red', children: [`⛔ CI red on #${alert.pr}: ${alert.summary.failing.join(', ')}`] }),
      Button({ key: 'ci-diagnose', label: 'Diagnose', onPress: () => { $.prompt.fill({ text: '/orc:ci ' + alert.pr }) } }),
      Button({ key: 'ci-dismiss', label: 'Dismiss', onPress: () => { ciAlert = null; $.ui.invalidate('ui.render') } }),
      await next(e),
    ] })
  })
}

// --- /orc cockpit -----------------------------------------------------------
// A pane with the flow's phase ladder, the slice ledger, the QA criteria, the
// PR's size and CI, the agents' usage, and the settled decisions (autopilot
// switchable), drawn without a model turn. Where nothing can draw (VS Code,
// claude -p) it answers with a text summary.
const PANE = 'orc-cockpit'
type Tab = 'flow' | 'slices' | 'qa' | 'pr' | 'agents' | 'decisions'
const TABS: [Tab, string, string][] = [
  ['flow', 'Flow', '1'], ['slices', 'Slices', '2'], ['qa', 'QA', '3'], ['pr', 'PR', '4'], ['agents', 'Agents', '5'], ['decisions', 'Decisions', '6'],
]
let tab: Tab = 'flow'
let snap: Snapshot = EMPTY

function register_cockpit(on: On) {
  on('command.run', { command: 'orc' }, async ($) => {
    await refresh($)
    snap = (await $.state.get(SNAPSHOT_REF)).value ?? EMPTY
    // A plain `claude -p` run has no surface (ui.open still reports "placed").
    if ((await $.session.surfaces()).length) {
      try {
        if ((await $.ui.open({ id: PANE, title: 'orc', focus: true, closeOnEscape: true })).isPlaced) return {}
      } catch {
        // the pane was refused: fall through to the text answer
      }
    }
    return { text: summaryText(snap) }
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    snap = (await $.state.get(SNAPSHOT_REF)).value ?? EMPTY
    const redraw = () => $.ui.invalidate('ui.render')
    const line = (text: string, style: { bold?: boolean; dimColor?: boolean; color?: string } = {}) => Text({ ...style, children: [text] })
    const s = snap.session
    let body = [line('Start one with /orc:flow <what to build>.')]
    if (s) {
      if (tab === 'flow') {
        body = [...(s.description ? [line(s.description, { dimColor: true })] : []), ...phaseRows(s).map(r => line(r, { bold: r.startsWith('▶') }))]
      } else if (tab === 'slices') {
        body = snap.slices.length
          ? snap.slices.map(x => line(sliceLine(x), { color: isDone(x) ? 'green' : x.status === 'pending' ? undefined : 'red' }))
          : [line('No slice ledger yet — /orc:plan writes one.', { dimColor: true })]
      } else if (tab === 'qa') {
        body = snap.qa
          ? [line('Verdict: ' + snap.qa.verdict.toUpperCase(), { bold: true, color: snap.qa.verdict === 'pass' ? 'green' : 'red' }),
              ...snap.qa.acceptance.map(c => line(criterionLine(c), { color: c.result === 'pass' ? 'green' : c.result === 'fail' ? 'red' : undefined })),
              ...(snap.qa.missing.length ? [line('Missing evidence: ' + snap.qa.missing.join(', '), { color: 'red' })] : []),
              Button({ key: 'qa-report', label: 'Render report', onPress: async () => {
                const path = await orc_report_html($)
                $.ui.toast(path ? 'QA report: ' + path : 'No QA packet to render')
              } })]
          : [line('No QA packet yet — /orc:qa writes one.', { dimColor: true })]
      } else if (tab === 'pr') {
        const prs = s.linkedPRs ?? []
        body = [
          ...(snap.size ? [line('Size  ' + sizeLine(snap.size), { color: snap.size.loc > snap.size.budget ? 'red' : undefined })] : []),
          ...(prs.length ? prs.map(p => line(`#${p.number ?? '?'}  ${p.url ?? ''}`)) : [line('No PR linked yet — /orc:ship opens one.', { dimColor: true })]),
          ...(ciAlert ? [line(`CI: ${ciAlert.summary.failing.length} failing (${ciAlert.summary.failing.join(', ')})`, { color: 'red' })] : []),
        ]
      } else if (tab === 'agents') {
        body = snap.usage?.length
          ? [line('agent                     runs   tokens            time', { dimColor: true }), ...snap.usage.map(u => line(usageLine(u)))]
          : [line('No subagent runs recorded yet.', { dimColor: true })]
      } else {
        const current = policyOf(snap) ?? 'manual'
        body = [Box({ flexDirection: 'row', columnGap: 2, children: [line('Autopilot:'),
          ...POLICIES.map(p => Button({ key: 'policy-' + p, label: p, hotkey: p[0], plain: true, dimColor: p !== current,
            onPress: async () => { await write_policy($, p); await refresh($) } }))] }),
          ...snap.decisions.map(d => line(`${d.key} = ${d.value}  (${d.provenance})`))]
      }
    }
    return Box({ flexDirection: 'column', children: [
      line(headline(snap), { bold: true }),
      Box({ flexDirection: 'row', columnGap: 3, children: TABS.map(([id, label, hotkey]) =>
        Button({ key: 'tab-' + id, label, hotkey, plain: true, dimColor: tab !== id, onPress: () => { tab = id; redraw() } })) }),
      line(' '),
      ...body,
      line(' '),
      Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'resume', label: s ? 'Resume (/orc:resume)' : 'New flow (/orc:flow)', hotkey: 'r',
          onPress: () => { $.prompt.fill({ text: s ? '/orc:resume' : '/orc:flow ' }) } }),
        Button({ key: 'refresh', label: 'Refresh', hotkey: 'f', onPress: async () => { await refresh($) } }),
      ] }),
    ] })
  })
}

// The user picked it in the pane, so it settles as an asked decision.
async function write_policy($: EngineInterface, value: string): Promise<void> {
  await $.process.run([$.plugin.root + '/bin/orc-state', 'decision', 'set', 'autopilotLevel', value, '--provenance', 'asked', '--supersede'])
}

async function orc_report_html($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run([$.plugin.root + '/bin/orc-report', 'html'], { timeoutMs: 10000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
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
    do { dirty = false; await $.state.set(SNAPSHOT_REF, await load_snapshot($)) } while (dirty)
  })().finally(() => { inflight = null })
  return inflight
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
