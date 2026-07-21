package tui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func toItems() []ToggleItem {
	return []ToggleItem{
		{Key: "a", Title: "Alpha", On: false},
		{Key: "b", Title: "Beta", On: true},
		{Key: "c", Title: "Gamma", On: false, Locked: true},
	}
}

func asToggle(t *testing.T, m tea.Model) ToggleModel {
	t.Helper()
	tm, ok := m.(ToggleModel)
	if !ok {
		t.Fatalf("expected ToggleModel, got %T", m)
	}
	return tm
}

func TestToggleSpaceChecksRow(t *testing.T) {
	var m tea.Model = NewToggle("Pick", toItems())
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(" ")}) // toggle first (a)
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	tm := asToggle(t, m)
	if !tm.Confirmed {
		t.Fatal("enter should confirm")
	}
	sel := tm.Selected()
	if !contains(sel, "a") || !contains(sel, "b") {
		t.Errorf("expected a and b selected, got %v", sel)
	}
}

func TestToggleRespectsLock(t *testing.T) {
	var m tea.Model = NewToggle("Pick", toItems())
	// Move to the locked item (index 2) and try to toggle it.
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(" ")})
	tm := asToggle(t, m)
	if contains(tm.Selected(), "c") {
		t.Error("locked row should not toggle on")
	}
}

func TestToggleCancel(t *testing.T) {
	var m tea.Model = NewToggle("Pick", toItems())
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	if asToggle(t, m).Confirmed {
		t.Error("q should cancel, not confirm")
	}
}

func TestToggleViewRendersCheckboxes(t *testing.T) {
	m := NewToggle("Pick", toItems())
	v := m.View()
	if !strings.Contains(v, "[x]") || !strings.Contains(v, "[ ]") {
		t.Errorf("view should show checked and unchecked boxes:\n%s", v)
	}
	if !strings.Contains(v, "installed") {
		t.Error("locked item should show an (installed) marker")
	}
}

func contains(s []string, v string) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}
