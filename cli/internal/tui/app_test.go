package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func fakeActions() Actions {
	return Actions{
		InstallPlugin: func() (string, error) { return "installed", nil },
		DoctorReport:  func() string { return "REPORT" },
		ToolItems:     func() []ToggleItem { return []ToggleItem{{Key: "jq", Title: "jq"}} },
		ApplyTools:    func(map[string]bool) (string, error) { return "toolout", nil },
		MCPItems:      func() []ToggleItem { return []ToggleItem{{Key: "github", Title: "github"}} },
		ApplyMCP:      func(map[string]bool) (string, error) { return "mcpout", nil },
		ConfigFields:  func() []ConfigField { return []ConfigField{{Key: "x", Label: "x", Kind: FieldBool}} },
		ApplyConfig:   func(map[string]string) (string, error) { return "configout", nil },
	}
}

func step(t *testing.T, m tea.Model, msg tea.Msg) App {
	t.Helper()
	next, _ := m.Update(msg)
	app, ok := next.(App)
	if !ok {
		t.Fatalf("expected App, got %T", next)
	}
	return app
}

func TestInitJumpsToStartAction(t *testing.T) {
	a := NewApp(fakeActions(), ActionMCP)
	cmd := a.Init()
	if cmd == nil {
		t.Fatal("Init should emit a SelectMsg cmd for a start action")
	}
	if msg, ok := cmd().(SelectMsg); !ok || msg.Action != ActionMCP {
		t.Fatalf("Init cmd should be SelectMsg{mcp}, got %#v", cmd())
	}
}

func TestDoctorGoesToResult(t *testing.T) {
	a := step(t, NewApp(fakeActions(), ""), SelectMsg{Action: ActionDoctor})
	if a.screen != scrResult {
		t.Fatalf("screen = %v; want result", a.screen)
	}
	if a.result.output != "REPORT" {
		t.Errorf("result = %q; want REPORT", a.result.output)
	}
}

func TestResultEnterReturnsToMenu(t *testing.T) {
	a := step(t, NewApp(fakeActions(), ""), SelectMsg{Action: ActionDoctor})
	a = step(t, a, tea.KeyMsg{Type: tea.KeyEnter})
	if a.screen != scrMenu {
		t.Errorf("after enter on result, screen = %v; want menu", a.screen)
	}
}

func TestToolsToggleThenRun(t *testing.T) {
	a := step(t, NewApp(fakeActions(), ""), SelectMsg{Action: ActionFix})
	if a.screen != scrTools {
		t.Fatalf("screen = %v; want tools", a.screen)
	}
	a = step(t, a, ToggleDoneMsg{Confirmed: true, Items: []ToggleItem{{Key: "jq", On: true}}})
	if a.screen != scrRunning {
		t.Fatalf("after confirm, screen = %v; want running", a.screen)
	}
	// Delivering the action's result advances to the result screen.
	a = step(t, a, resultMsg{title: "Tools", output: "toolout"})
	if a.screen != scrResult || a.result.output != "toolout" {
		t.Errorf("screen=%v output=%q; want result/toolout", a.screen, a.result.output)
	}
}

func TestToggleCancelReturnsToMenu(t *testing.T) {
	a := step(t, NewApp(fakeActions(), ""), SelectMsg{Action: ActionMCP})
	a = step(t, a, ToggleDoneMsg{Confirmed: false})
	if a.screen != scrMenu {
		t.Errorf("cancel should return to menu, got %v", a.screen)
	}
}

func TestRunActionProducesResult(t *testing.T) {
	msg := runAction("T", func() (string, error) { return "hi", nil })()
	rm, ok := msg.(resultMsg)
	if !ok || rm.output != "hi" || rm.title != "T" {
		t.Fatalf("runAction returned %#v", msg)
	}
}

func TestCtrlCQuits(t *testing.T) {
	_, cmd := NewApp(fakeActions(), "").Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	if cmd == nil {
		t.Fatal("ctrl+c should return a quit cmd")
	}
}
