package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func formFields() []ConfigField {
	return []ConfigField{
		{Key: "pr_size_budget", Label: "pr_size_budget", Kind: FieldInt, Value: "300"},
		{Key: "skip_tool_check", Label: "skip_tool_check", Kind: FieldBool, Value: ""},
	}
}

func TestFormEnterEmitsValues(t *testing.T) {
	m := NewConfigForm("t", formFields())
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("enter should emit a FormDoneMsg cmd")
	}
	msg, ok := cmd().(FormDoneMsg)
	if !ok || !msg.Confirmed {
		t.Fatalf("expected confirmed FormDoneMsg, got %#v", cmd())
	}
	if msg.Values["pr_size_budget"] != "300" {
		t.Errorf("pr_size_budget = %q; want 300", msg.Values["pr_size_budget"])
	}
	if msg.Values["skip_tool_check"] != "false" {
		t.Errorf("skip_tool_check = %q; want false", msg.Values["skip_tool_check"])
	}
}

func TestFormSpaceTogglesBool(t *testing.T) {
	var m tea.Model = NewConfigForm("t", formFields())
	// Move to the bool field (index 1) and toggle it on.
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(" ")})
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	msg := cmd().(FormDoneMsg)
	if msg.Values["skip_tool_check"] != "true" {
		t.Errorf("after toggle, skip_tool_check = %q; want true", msg.Values["skip_tool_check"])
	}
}

func TestFormEscCancels(t *testing.T) {
	m := NewConfigForm("t", formFields())
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	msg, ok := cmd().(FormDoneMsg)
	if !ok || msg.Confirmed {
		t.Fatalf("esc should emit an unconfirmed FormDoneMsg, got %#v", cmd())
	}
}

func TestFormTypingEditsTextField(t *testing.T) {
	var m tea.Model = NewConfigForm("t", formFields())
	// Focus starts on the int field; type "5".
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("5")})
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	msg := cmd().(FormDoneMsg)
	if msg.Values["pr_size_budget"] != "3005" {
		t.Errorf("typing should append to the field: got %q", msg.Values["pr_size_budget"])
	}
}
