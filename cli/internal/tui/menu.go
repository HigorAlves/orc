package tui

import (
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
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
		menuItem{ActionFix, "Manage tools", "Toggle which runtime tools to install"},
		menuItem{ActionConfig, "Configure", "View orc tunables (PR size, protected branches, …)"},
		menuItem{ActionMCP, "MCP servers", "Toggle MCP servers (GitHub, Jira, Sentry, Vercel)"},
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
	l.SetShowTitle(false) // the mascot banner is our header
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.SetShowHelp(true)
	return MenuModel{list: l}
}

func (m MenuModel) Init() tea.Cmd { return nil }

func (m MenuModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		// Reserve room for the mascot banner (+1 spacer line) above the list.
		listH := msg.Height - BannerHeight() - 1
		if listH < 1 {
			listH = 1
		}
		m.list.SetSize(msg.Width, listH)
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
	return lipgloss.JoinVertical(lipgloss.Left, Banner(), "", m.list.View())
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
