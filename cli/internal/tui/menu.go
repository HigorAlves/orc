package tui

import (
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

// Action identifiers returned by the menu.
const (
	ActionInstall = "install"
	ActionDoctor  = "doctor"
	ActionFix     = "fix"
	ActionConfig  = "config"
	ActionMCP     = "mcp"
	ActionQuit    = ""
)

type menuItem struct {
	id    string
	title string
	desc  string
}

func (i menuItem) Title() string       { return i.title }
func (i menuItem) Description() string { return i.desc }
func (i menuItem) FilterValue() string { return i.title }

func menuItems() []list.Item {
	return []list.Item{
		menuItem{ActionInstall, "Install / update plugin", "Register the orc marketplace and enable the plugin"},
		menuItem{ActionDoctor, "Check tools", "Verify orc's required + recommended CLIs"},
		menuItem{ActionFix, "Install missing tools", "Install missing dependencies via your package manager"},
		menuItem{ActionConfig, "Configure", "View orc tunables (PR size, protected branches, …)"},
		menuItem{ActionMCP, "MCP servers", "List configured MCP servers"},
		menuItem{"quit", "Quit", ""},
	}
}

// MenuModel is the home-screen Bubble Tea model. On selection it records the
// chosen action id in Choice and quits; the caller dispatches to the matching
// command.
type MenuModel struct {
	list   list.Model
	Choice string
}

// NewMenu builds the home menu model.
func NewMenu() MenuModel {
	l := list.New(menuItems(), list.NewDefaultDelegate(), 0, 0)
	l.Title = "orc — plugin installer & toolbox"
	l.Styles.Title = titleStyle
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.SetShowHelp(true)
	return MenuModel{list: l}
}

func (m MenuModel) Init() tea.Cmd { return nil }

func (m MenuModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.list.SetSize(msg.Width, msg.Height)
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			m.Choice = ActionQuit
			return m, tea.Quit
		case "enter":
			if it, ok := m.list.SelectedItem().(menuItem); ok {
				if it.id == "quit" {
					m.Choice = ActionQuit
				} else {
					m.Choice = it.id
				}
			}
			return m, tea.Quit
		}
	}
	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}

func (m MenuModel) View() string {
	return m.list.View()
}

// RunMenu runs the interactive home menu and returns the chosen action id
// (ActionQuit when the user quits).
func RunMenu() (string, error) {
	m := NewMenu()
	p := tea.NewProgram(m, tea.WithAltScreen())
	final, err := p.Run()
	if err != nil {
		return ActionQuit, err
	}
	if fm, ok := final.(MenuModel); ok {
		return fm.Choice, nil
	}
	return ActionQuit, nil
}
