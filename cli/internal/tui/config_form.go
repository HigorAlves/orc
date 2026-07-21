package tui

import (
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

// FieldKind is the input type of a config field.
type FieldKind int

const (
	FieldString FieldKind = iota
	FieldInt
	FieldBool
)

// ConfigField describes one editable tunable.
type ConfigField struct {
	Key   string
	Label string
	Desc  string
	Kind  FieldKind
	Value string // initial value ("1"/"true" for a set bool; the raw string otherwise)
}

// ConfigModel is a small form: arrow keys move between fields, text/number
// fields are edited in place, space toggles a bool field, enter saves, esc
// cancels.
type ConfigModel struct {
	title     string
	fields    []ConfigField
	inputs    []textinput.Model
	bools     []bool
	cursor    int
	Confirmed bool
	Values    map[string]string
}

// NewConfigForm builds the form from the given fields.
func NewConfigForm(title string, fields []ConfigField) ConfigModel {
	m := ConfigModel{title: title, fields: fields}
	m.inputs = make([]textinput.Model, len(fields))
	m.bools = make([]bool, len(fields))
	for i, f := range fields {
		switch f.Kind {
		case FieldBool:
			m.bools[i] = f.Value == "1" || strings.EqualFold(f.Value, "true")
		default:
			ti := textinput.New()
			ti.SetValue(f.Value)
			ti.Prompt = ""
			ti.CharLimit = 200
			m.inputs[i] = ti
		}
	}
	m.focus(0)
	return m
}

func (m *ConfigModel) focus(idx int) {
	for i := range m.inputs {
		m.inputs[i].Blur()
	}
	m.cursor = idx
	if idx >= 0 && idx < len(m.fields) && m.fields[idx].Kind != FieldBool {
		m.inputs[idx].Focus()
	}
}

func (m ConfigModel) Init() tea.Cmd { return textinput.Blink }

func (m ConfigModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		// Forward non-key messages (e.g. cursor blink) to the focused input.
		if m.current().Kind != FieldBool {
			var cmd tea.Cmd
			m.inputs[m.cursor], cmd = m.inputs[m.cursor].Update(msg)
			return m, cmd
		}
		return m, nil
	}

	switch key.String() {
	case "ctrl+c", "esc":
		return m, cmdMsg(FormDoneMsg{Confirmed: false})
	case "enter":
		return m, cmdMsg(FormDoneMsg{Confirmed: true, Values: m.values()})
	case "up", "shift+tab":
		if m.cursor > 0 {
			m.focus(m.cursor - 1)
		}
		return m, nil
	case "down", "tab":
		if m.cursor < len(m.fields)-1 {
			m.focus(m.cursor + 1)
		}
		return m, nil
	case " ":
		if m.current().Kind == FieldBool {
			m.bools[m.cursor] = !m.bools[m.cursor]
			return m, nil
		}
	}

	// Otherwise edit the focused text/number field.
	if m.current().Kind != FieldBool {
		var cmd tea.Cmd
		m.inputs[m.cursor], cmd = m.inputs[m.cursor].Update(msg)
		return m, cmd
	}
	return m, nil
}

func (m ConfigModel) current() ConfigField {
	if m.cursor >= 0 && m.cursor < len(m.fields) {
		return m.fields[m.cursor]
	}
	return ConfigField{}
}

// values collects the current field values keyed by field Key.
func (m ConfigModel) values() map[string]string {
	out := make(map[string]string, len(m.fields))
	for i, f := range m.fields {
		if f.Kind == FieldBool {
			if m.bools[i] {
				out[f.Key] = "true"
			} else {
				out[f.Key] = "false"
			}
			continue
		}
		out[f.Key] = strings.TrimSpace(m.inputs[i].Value())
	}
	return out
}

func (m ConfigModel) View() string {
	title := m.title
	if title == "" {
		title = "Configure orc"
	}
	var b strings.Builder
	b.WriteString(toggleTitleStyle.Render(title))
	b.WriteString("\n")

	for i, f := range m.fields {
		cursor := "  "
		if i == m.cursor {
			cursor = toggleCursorStyle.Render("❯ ")
		}
		var val string
		if f.Kind == FieldBool {
			if m.bools[i] {
				val = toggleOnStyle.Render("[x] on")
			} else {
				val = "[ ] off"
			}
		} else {
			val = m.inputs[i].View()
			if i == m.cursor {
				val = toggleOnStyle.Render("› ") + val
			}
		}
		b.WriteString(cursor + f.Label + ": " + val + "\n")
		if f.Desc != "" {
			b.WriteString("      " + toggleDescStyle.Render(f.Desc) + "\n")
		}
	}

	b.WriteString("\n")
	b.WriteString(toggleDescStyle.Render("↑/↓ move · type to edit · space toggle · enter save · esc cancel"))
	return b.String()
}
