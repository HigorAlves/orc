// The value behind $.orc.status(): a pure summary of the live snapshot.
import type { OrcStatusInfo } from '../../types'
import { isDone, policyOf, type Snapshot } from './cockpit'

export function statusInfo(snap: Snapshot): OrcStatusInfo {
  const s = snap.session
  const pr = s?.linkedPRs?.[0]
  return {
    phase: s ? s.phase : null,
    phaseLabel: s?.phaseLabel ?? null,
    slicesDone: snap.slices.filter(isDone).length,
    slicesTotal: snap.slices.length,
    qa: snap.qa?.verdict ?? null,
    pr: pr ? (pr.number ?? pr.url ?? null) : null,
    policy: policyOf(snap) ?? null,
  }
}
