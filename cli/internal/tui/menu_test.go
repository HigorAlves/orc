package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func asMenu(t *testing.T, m tea.Model) MenuModel {
	t.Helper()
	mm, ok := m.(MenuModel)
	if !ok {
		t.Fatalf("expected MenuModel, got %T", m)
	}
	return mm
}

func TestEnterSelectsFirstAction(t *testing.T) {
	m := NewMenu()
	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if got := asMenu(t, next).Choice; got != ActionInstall {
		t.Errorf("Choice = %q; want %q", got, ActionInstall)
	}
}

func TestArrowThenEnterSelectsDoctor(t *testing.T) {
	var m tea.Model = NewMenu()
	m, _ = m.Update(tea.WindowSizeMsg{Width: 80, Height: 24})
	// Install → Init → Doctor is two rows down.
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if got := asMenu(t, m).Choice; got != ActionDoctor {
		t.Errorf("Choice = %q; want %q", got, ActionDoctor)
	}
}

func TestQuitKey(t *testing.T) {
	m := NewMenu()
	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	if got := asMenu(t, next).Choice; got != ActionQuit {
		t.Errorf("Choice = %q; want quit (empty)", got)
	}
}

func TestSelectingQuitItem(t *testing.T) {
	var m tea.Model = NewMenu()
	m, _ = m.Update(tea.WindowSizeMsg{Width: 80, Height: 24})
	// Move to the last item (Quit). Count the menu rows dynamically.
	for i := 0; i < len(menuItems())-1; i++ {
		m, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	}
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if got := asMenu(t, m).Choice; got != ActionQuit {
		t.Errorf("Choice = %q; want quit (empty)", got)
	}
}
