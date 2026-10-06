// Gate chrome: the class of an orc gate, read from the AskUserQuestion header
// chips orc:gates reserves (a closed vocabulary), so the dialog can say which
// gates no autopilot level will ever answer. Other dialogs get no badge.

const OUTWARD = new Set(['Publish', 'Post', 'Tracker'])

export function gateBadge(questions: readonly unknown[]): string | null {
  const headers = questions.map(q => (q && typeof q === 'object' ? (q as { header?: unknown }).header : undefined))
  if (headers.some(h => typeof h === 'string' && OUTWARD.has(h))) {
    return '⛔ orc · outward gate — this writes outside your machine; no autopilot level answers it'
  }
  if (headers.includes('Escalation')) return '▲ orc · escalation — the run stopped and needs your decision'
  return null
}
