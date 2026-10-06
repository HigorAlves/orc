// The /orc cockpit's drawing: pure. register.ts owns every `$` call (the
// engine's scan follows `$` only inside that file), builds the callbacks, and
// hands this module the element table, the data and the actions.
import type { EngineInterface } from 'claude-code'
import type { OrcDetails, OrcSections } from '../../types'
import { POLICIES, attention, criterionLine, currentSlice, headerCells, isDone, layoutFor, phaseRows, policyOf, sectionLabel, sizeLine, sliceLine, usageLine, type SectionId, type Snapshot } from './cockpit'
import type { Profile } from './profiles'
import type { CiAlert } from './state'

export const PANE = 'orc-cockpit'

export type Els = ReturnType<EngineInterface['ui']['resolve']>
export type PaneModel = {
  snap: Snapshot
  profile: Profile
  placement: 'dock' | 'inline'
  bodyColumns: number
  sections: OrcSections
  ciAlert: CiAlert
  details: OrcDetails
}
export type PaneActions = { resume: () => void; toggle: (id: SectionId) => () => void; renderReport: () => void; settle: (key: string, value: string) => void }

const PROFILES = ['balanced', 'quality', 'economy'] as const

export function drawPane(els: Els, model: PaneModel, actions: PaneActions) {
  const { Box, Text, Button, Link } = els
  // The mobile app draws no Select yet; the section then shows the decisions as text only.
  const Select = 'Select' in els ? els.Select : null
  const Markdown = 'Markdown' in els ? els.Markdown : null
  const Code = 'Code' in els ? els.Code : null
  const { snap } = model
  const s = snap.session
  const line = (text: string, style: { bold?: boolean; dimColor?: boolean; color?: string } = {}) => Text({ ...style, children: [text] })

  const header = Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children:
    headerCells(snap, model.profile).map(c => line(c.text, { bold: c.bold, dimColor: c.dim, color: c.color })) })

  const ladder = s
    ? Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, width: 28, children: [
        line('Phases', { bold: true }),
        ...phaseRows(s).map(r => line(r, r.startsWith('▶') ? { bold: true, color: 'cyan' } : r.startsWith('✓') ? { color: 'green' } : { dimColor: true })),
      ] })
    : null
  const ledger = Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, flexGrow: 1, children: [
    line('Slices', { bold: true }),
    ...(snap.slices.length
      ? snap.slices.map(x => line(sliceLine(x), { color: isDone(x) ? 'green' : x.status === 'pending' ? undefined : 'red' }))
      : [line('No slice ledger yet — /orc:plan writes one.', { dimColor: true })]),
  ] })
  const body = Box({ flexDirection: layoutFor(model.placement, model.bodyColumns), columnGap: 1, children: [...(ladder ? [ladder] : []), ledger] })

  const flagged = attention(snap, model.ciAlert !== null)
  const section = (id: SectionId, hotkey: string, children: () => ReturnType<typeof Box>[]) =>
    Box({ flexDirection: 'column', children: [
      Button({ key: 'sec-' + id, plain: true, hotkey, label: sectionLabel(id, model.sections[id], flagged.has(id)), onPress: actions.toggle(id) }),
      ...(model.sections[id] ? [Box({ flexDirection: 'column', paddingLeft: 2, children: children() })] : []),
    ] })

  const qa = section('qa', 'q', () => snap.qa
    ? [line('Verdict: ' + snap.qa.verdict.toUpperCase(), { bold: true, color: snap.qa.verdict === 'pass' ? 'green' : 'red' }),
       ...snap.qa.acceptance.map(c => line(criterionLine(c), { color: c.result === 'pass' ? 'green' : c.result === 'fail' ? 'red' : undefined })),
       ...(snap.qa.missing.length ? [line('Missing evidence: ' + snap.qa.missing.join(', '), { color: 'red' })] : []),
       Button({ key: 'qa-report', label: 'Render report', onPress: actions.renderReport })]
    : [line('No QA packet yet — /orc:qa writes one.', { dimColor: true })])

  const prs = s?.linkedPRs ?? []
  const alert = model.ciAlert
  const pr = section('pr', 'p', () => [
    ...(snap.size ? [line('Size  ' + sizeLine(snap.size), { color: snap.size.loc > snap.size.budget ? 'red' : undefined })] : []),
    ...(prs.length
      ? prs.map(p => Box({ flexDirection: 'row', columnGap: 1, children: [line(`#${p.number ?? '?'}`), ...(p.url ? [Link({ href: p.url, label: p.url })] : [])] }))
      : [line('No PR linked yet — /orc:ship opens one.', { dimColor: true })]),
    ...(alert ? [line(`CI: ${alert.summary.failing.length} failing (${alert.summary.failing.join(', ')})`, { color: 'red' })] : []),
  ])

  const agents = section('agents', 'g', () => snap.usage?.length
    ? [line('agent                     runs   tokens            time', { dimColor: true }), ...snap.usage.map(u => line(usageLine(u)))]
    : [line('No subagent runs recorded yet.', { dimColor: true })])

  const policy = policyOf(snap) ?? 'manual'
  const decisions = section('decisions', 'd', () => [
    ...(Select ? [Select({ key: 'policy', label: 'Autopilot', options: POLICIES.map(p => ({ value: p })), value: policy,
      onSelect: (v: string) => { if (v !== policy) actions.settle('autopilotLevel', v) } })] : []),
    ...(Select ? [Select({ key: 'profile', label: 'Model profile', options: PROFILES.map(p => ({ value: p })), value: model.profile,
      onSelect: (v: string) => { if (v !== model.profile) actions.settle('modelProfile', v) } })] : []),
    ...snap.decisions.map(d => line(`${d.key} = ${d.value}  (${d.provenance})`, { dimColor: true })),
  ])

  const { details } = model
  const loading = [line('Loading…', { dimColor: true })]
  const digest = section('digest', 'c', () => details.digest === null
    ? loading
    : details.digest ? [Markdown ? Markdown({ text: details.digest }) : line(details.digest)] : [line('No resume digest yet.', { dimColor: true })])

  const cur = currentSlice(snap.slices)
  const diff = section('diff', 'x', () => details.diff === null
    ? loading
    : [line(cur ? `Slice #${cur.id} ${cur.title}${cur.commit ? ' · ' + cur.commit : ' · working tree'}` : 'Working tree', { bold: true }),
       ...(details.diff ? [Code ? Code({ source: details.diff, format: 'diff', wrap: 'truncate-end' }) : line(details.diff)] : [line('No changes.', { dimColor: true })]),
       ...(details.diffTruncated ? [line('truncated — open the file for the rest', { dimColor: true })] : [])])

  const footer = Box({ flexDirection: 'row', columnGap: 2, children: [
    Button({ key: 'resume', variant: 'primary', label: s ? 'Resume (/orc:resume)' : 'New flow (/orc:flow)', hotkey: 'r', onPress: actions.resume }),
  ] })

  return Box({ flexDirection: 'column', rowGap: 1, children: [header, body, qa, pr, agents, decisions, digest, diff, footer] })
}
