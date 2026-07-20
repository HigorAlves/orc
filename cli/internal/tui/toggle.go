package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ToggleItem is one checkbox row.
type ToggleItem struct {
	Key    string // stable identifier returned to the caller
	Title  string
	Desc   string
	On     bool   // current checked state
	Locked bool   // cannot be toggled (e.g. an already-installed required tool)
	Note   string // extra hint shown under the row (e.g. install hint)
}

// ToggleModel is a reusable multi-select checkbox list. Space toggles the row
// under the cursor (unless locked); enter confirms; q/esc cancels.
type ToggleModel struct {
	Title     string
	Items     []ToggleItem
	Confirmed bool
	cursor    int
}

// NewToggle builds a toggle screen.
func NewToggle(title string, items []ToggleItem) ToggleModel {
	return ToggleModel{Title: title, Items: items}
}

func (m ToggleModel) Init() tea.Cmd { return nil }

func (m ToggleModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if key, ok := msg.(tea.KeyMsg); ok {
		switch key.String() {
		case "ctrl+c", "q", "esc":
			m.Confirmed = false
			return m, tea.Quit
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.Items)-1 {
				m.cursor++
			}
		case " ", "x":
			if m.cursor < len(m.Items) && !m.Items[m.cursor].Locked {
				m.Items[m.cursor].On = !m.Items[m.cursor].On
			}
		case "enter":
			m.Confirmed = true
			return m, tea.Quit
		}
	}
	return m, nil
}

var (
	toggleCursorStyle = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
	toggleOnStyle     = lipgloss.NewStyle().Foreground(colorSuccess).Bold(true)
	toggleDescStyle   = lipgloss.NewStyle().Foreground(colorMuted)
	toggleTitleStyle  = lipgloss.NewStyle().Foreground(colorAccent).Bold(true).Padding(0, 0, 1, 0)
)

func (m ToggleModel) View() string {
	var b strings.Builder
	b.WriteString(toggleTitleStyle.Render(m.Title))
	b.WriteString("\n")

	for i, it := range m.Items {
		cursor := "  "
		if i == m.cursor {
			cursor = toggleCursorStyle.Render("❯ ")
		}
		box := "[ ]"
		if it.On {
			box = toggleOnStyle.Render("[x]")
		}
		lock := ""
		if it.Locked {
			lock = toggleDescStyle.Render(" (installed)")
		}
		b.WriteString(cursor + box + " " + it.Title + lock + "\n")
		if it.Desc != "" {
			b.WriteString("      " + toggleDescStyle.Render(it.Desc) + "\n")
		}
		if it.Note != "" {
			b.WriteString("      " + toggleDescStyle.Render(it.Note) + "\n")
		}
	}

	b.WriteString("\n")
	b.WriteString(toggleDescStyle.Render("↑/↓ move · space toggle · enter apply · q cancel"))
	return b.String()
}

// Selected returns the keys whose rows are checked.
func (m ToggleModel) Selected() []string {
	var out []string
	for _, it := range m.Items {
		if it.On {
			out = append(out, it.Key)
		}
	}
	return out
}

// RunToggle runs the toggle screen and returns the final model (with the user's
// choices in Items and whether they confirmed).
func RunToggle(title string, items []ToggleItem) (ToggleModel, error) {
	final, err := tea.NewProgram(NewToggle(title, items)).Run()
	if err != nil {
		return ToggleModel{}, err
	}
	if fm, ok := final.(ToggleModel); ok {
		return fm, nil
	}
	return ToggleModel{}, nil
}
