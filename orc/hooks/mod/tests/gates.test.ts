import { expect, test } from 'claude-code/testing'

const DIALOG = (header: string) => ({
  plugin: 'orc', component: 'AskUserQuestion' as const, requestId: 'toolu_1', surface: 'terminal' as const,
  viewport: { columns: 120, rows: 40 },
  props: { tool: 'AskUserQuestion', questions: [{ header, question: 'Proceed?', multiSelect: false, options: [{ label: 'Yes', description: 'y' }, { label: 'No', description: 'n' }] }] as unknown[] },
})

// What core answers from next(e): a reference to its own dialog, which must appear exactly once.
const ENGINE = () => ({ type: 'engine' as const, ref: 0 })

test('an outward gate gets the always-asks badge above the engine dialog', async ($, on) => {
  on('ui.render', ENGINE)
  const ui = await $.ui.mount(DIALOG('Publish'))
  expect(await ui.find({ type: 'Text', text: /outward gate/ })).toBeDefined()
  expect(await ui.find({ type: 'engine' })).toBeDefined()
})

test('an escalation gets its badge', async ($, on) => {
  on('ui.render', ENGINE)
  const ui = await $.ui.mount(DIALOG('Escalation'))
  expect(await ui.find({ type: 'Text', text: /escalation/ })).toBeDefined()
})

test('any other dialog is left exactly as the engine draws it', async ($, on) => {
  on('ui.render', ENGINE)
  const ui = await $.ui.mount(DIALOG('Plan'))
  expect(await ui.find({ type: 'Text', text: /orc ·/ })).toBeUndefined()
  expect(await ui.find({ type: 'engine' })).toBeDefined()
})
