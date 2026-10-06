// The orc mod: in-process event hooks layered on top of orc's bash settings
// hooks, which stay the safety floor. Nothing here replaces a guard — when
// mods can't load (Claude Code < 2.1.287, --safe-mode, disableAllHooks, an
// org policy) or `mod_enabled` is false, orc behaves exactly as without it.
import type { EngineInterface, On, PluginOptions } from 'claude-code'
import {
  EMPTY, POLICIES, headline, isDone, parseDecisions, parseSession, parseSlices, phaseRows, policyOf, sliceLine, summaryText,
  type Snapshot,
} from './cockpit'

export function register(on: On, options: PluginOptions) {
  if (options.mod_enabled === false) return
  register_attribution(on)
  register_compaction(on)
  register_cockpit(on)
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
    const line = await orc_state_line($)
    if (!line) return next(e)
    const note = 'orc session state (authoritative, from orc-state): ' + line +
      ' — keep the current phase, slice progress, and any pending gate decision in the summary.'
    return next({ ...e, instructions: e.instructions ? e.instructions + '\n\n' + note : note })
  })
}

// One-line JSON of the live orc session, or '' when there is none (or it can't be read).
async function orc_state_line($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run([$.plugin.root + '/bin/orc-state', 'line'], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

// /orc — the cockpit: a pane with the flow's phase ladder, the slice ledger, and
// the settled decisions (autopilot level editable), drawn without a model turn.
// Where nothing can draw (VS Code, claude -p) it answers with a text summary.
const PANE = 'orc-cockpit'
let tab: 'flow' | 'slices' | 'decisions' = 'flow'
let snap: Snapshot = EMPTY

function register_cockpit(on: On) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'orc', description: 'orc cockpit — phase, slices, decisions (no model turn)', immediate: true })
    } catch {
      // name taken in this build: the markdown /orc:status stays the fallback
    }
    return next(e)
  })

  on('command.run', { command: 'orc' }, async ($) => {
    snap = await load_snapshot($)
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
    const redraw = () => $.ui.invalidate('ui.render')
    const tabButton = (id: typeof tab, label: string, hotkey: string) =>
      Button({ key: 'tab-' + id, label, hotkey, plain: true, dimColor: tab !== id, onPress: () => { tab = id; redraw() } })
    const s = snap.session
    let body = [Text({ children: ['Start one with /orc:flow <what to build>.'] })]
    if (s && tab === 'flow') {
      body = [...(s.description ? [Text({ dimColor: true, children: [s.description] })] : []),
        ...phaseRows(s).map(row => Text({ bold: row.startsWith('▶'), children: [row] }))]
    } else if (s && tab === 'slices') {
      body = snap.slices.length
        ? snap.slices.map(x => Text({ color: isDone(x) ? 'green' : x.status === 'pending' ? undefined : 'red', children: [sliceLine(x)] }))
        : [Text({ dimColor: true, children: ['No slice ledger yet — /orc:plan writes one.'] })]
    } else if (s) {
      const current = policyOf(snap) ?? 'manual'
      body = [Box({ flexDirection: 'row', columnGap: 2, children: [Text({ children: ['Autopilot:'] }),
        ...POLICIES.map(p => Button({ key: 'policy-' + p, label: p, hotkey: p[0], plain: true, dimColor: p !== current,
          onPress: async () => { await write_policy($, p); snap = await load_snapshot($); redraw() } }))] }),
        ...snap.decisions.map(d => Text({ children: [`${d.key} = ${d.value}  (${d.provenance})`] }))]
    }
    return Box({ flexDirection: 'column', children: [
      Text({ bold: true, children: [headline(snap)] }),
      Box({ flexDirection: 'row', columnGap: 3, children: [
        tabButton('flow', 'Flow', '1'), tabButton('slices', 'Slices', '2'), tabButton('decisions', 'Decisions', '3'),
      ] }),
      Text({ children: [' '] }),
      ...body,
      Text({ children: [' '] }),
      Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'resume', label: s ? 'Resume (/orc:resume)' : 'New flow (/orc:flow)', hotkey: 'r',
          onPress: () => { $.prompt.fill({ text: s ? '/orc:resume' : '/orc:flow ' }) } }),
        Button({ key: 'refresh', label: 'Refresh', hotkey: 'f', onPress: async () => { snap = await load_snapshot($); redraw() } }),
      ] }),
    ] })
  })
}

async function load_snapshot($: EngineInterface): Promise<Snapshot> {
  const bin = $.plugin.root + '/bin/orc-state'
  const run = (argv: string[]) => $.process.run([bin, ...argv], { timeoutMs: 5000 }).then(r => (r.exitCode === 0 ? r.stdout : ''), () => '')
  const [session, slices, decisions] = await Promise.all([run(['get']), run(['slice', 'list']), run(['decision', 'get'])])
  return { session: parseSession(session), slices: parseSlices(slices), decisions: parseDecisions(decisions) }
}

// The user picked it in the pane, so it settles as an asked decision.
async function write_policy($: EngineInterface, value: string): Promise<void> {
  await $.process.run([$.plugin.root + '/bin/orc-state', 'decision', 'set', 'autopilotLevel', value, '--provenance', 'asked', '--supersede'])
}
