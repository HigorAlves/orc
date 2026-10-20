// Terminal drawing of the sentinel card: a Box/Text tree from an element table.
import type { Els } from '../pane'
import type { SentinelNote } from './checks'

export type SentinelActions = { learn: () => void; chat: () => void; dismiss: () => void }

export function sentinelText(els: Els, note: SentinelNote, actions: SentinelActions, expanded?: string | null) {
  const { Box, Text, Button } = els
  return Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, children: [
    Text({ bold: true, color: 'yellow', children: ['✦ heads up'] }),
    Text({ children: [note.text] }),
    ...(expanded ? [Text({ dimColor: true, children: [expanded] })] : []),
    Box({ flexDirection: 'row', columnGap: 1, children: [
      Button({ key: 'sentinel-learn', label: 'Learn more', onPress: actions.learn }),
      Button({ key: 'sentinel-chat', label: 'Chat in main session', onPress: actions.chat }),
      Button({ key: 'sentinel-dismiss', label: 'Dismiss', hotkey: 'x', onPress: actions.dismiss }),
    ] }),
  ] })
}
