package tui

import tea "github.com/charmbracelet/bubbletea"

// Completion messages let sub-screens report back to the parent App without
// quitting the whole program, so navigation stays inside one alt-screen session.
type (
	// SelectMsg is emitted by the home menu when an action is chosen.
	SelectMsg struct{ Action string }

	// ToggleDoneMsg is emitted by a toggle screen on confirm/cancel.
	ToggleDoneMsg struct {
		Confirmed bool
		Items     []ToggleItem
	}

	// FormDoneMsg is emitted by the config form on save/cancel.
	FormDoneMsg struct {
		Confirmed bool
		Values    map[string]string
	}

	// resultMsg carries the captured output of a completed action.
	resultMsg struct {
		title  string
		output string
		err    error
	}
)

// cmdMsg wraps a message value as a tea.Cmd.
func cmdMsg(m tea.Msg) tea.Cmd {
	return func() tea.Msg { return m }
}
