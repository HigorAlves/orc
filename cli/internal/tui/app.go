package tui

import (
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Actions are the side-effecting callbacks the App invokes. They are injected by
// the cli layer so this package stays UI-only. Apply* functions run their work
// and return captured output (never writing to os.Stdout, which would corrupt
// the alt-screen) so it can be shown on the result screen.
type Actions struct {
	InstallPlugin func() (string, error)
	DoctorReport  func() string
	ToolItems     func() []ToggleItem
	ApplyTools    func(desiredOn map[string]bool) (string, error)
	MCPItems      func() []ToggleItem
	ApplyMCP      func(desiredOn map[string]bool) (string, error)
	ConfigFields  func() []ConfigField
	ApplyConfig   func(values map[string]string) (string, error)
	InitFields    func() []ConfigField
	ApplyInit     func(values map[string]string) (string, error)
}

type screen int

const (
	scrMenu screen = iota
	scrTools
	scrMCP
	scrConfig
	scrRunning
	scrResult
)

// App is the root model: a state machine over the screens, all rendered inside a
// single alt-screen session so navigation feels native.
type App struct {
	actions Actions
	screen  screen
	start   string // action to jump to on first render ("" = menu)

	menu   MenuModel
	toggle ToggleModel
	form   ConfigModel

	spinner    spinner.Model
	result     resultMsg
	width      int
	height     int
	toggleKind string
	formKind   string // "config" | "init"
}

// NewApp builds the application. startAction jumps straight to a screen
// (ActionMCP/ActionFix/ActionConfig/ActionInstall); "" opens the menu.
func NewApp(actions Actions, startAction string) App {
	sp := spinner.New()
	sp.Spinner = spinner.Dot
	sp.Style = lipgloss.NewStyle().Foreground(colorAccent)
	return App{
		actions: actions,
		menu:    NewMenu(),
		spinner: sp,
		start:   startAction,
	}
}

func (a App) Init() tea.Cmd {
	if a.start != "" {
		return cmdMsg(SelectMsg{Action: a.start})
	}
	return nil
}

func (a App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width, a.height = msg.Width, msg.Height
		var cmd tea.Cmd
		var m tea.Model
		m, cmd = a.menu.Update(msg)
		a.menu = m.(MenuModel)
		return a, cmd

	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return a, tea.Quit
		}
		if a.screen == scrResult {
			switch msg.String() {
			case "enter", "esc", "q":
				a.screen = scrMenu
				return a, nil
			}
			return a, nil
		}

	case SelectMsg:
		return a.handleSelect(msg.Action)

	case ToggleDoneMsg:
		if !msg.Confirmed {
			a.screen = scrMenu
			return a, nil
		}
		desired := map[string]bool{}
		for _, it := range msg.Items {
			desired[it.Key] = it.On
		}
		apply := a.actions.ApplyTools
		title := "Tools"
		if a.toggleKind == "mcp" {
			apply = a.actions.ApplyMCP
			title = "MCP servers"
		}
		a.screen = scrRunning
		return a, tea.Batch(a.spinner.Tick, runAction(title, func() (string, error) { return apply(desired) }))

	case FormDoneMsg:
		if !msg.Confirmed {
			a.screen = scrMenu
			return a, nil
		}
		vals := msg.Values
		a.screen = scrRunning
		apply := a.actions.ApplyConfig
		title := "Configure"
		if a.formKind == "init" {
			apply = a.actions.ApplyInit
			title = "Init .orc"
		}
		return a, tea.Batch(a.spinner.Tick, runAction(title, func() (string, error) { return apply(vals) }))

	case resultMsg:
		a.result = msg
		a.screen = scrResult
		return a, nil

	case spinner.TickMsg:
		if a.screen == scrRunning {
			var cmd tea.Cmd
			a.spinner, cmd = a.spinner.Update(msg)
			return a, cmd
		}
		return a, nil
	}

	// Delegate to the active screen.
	return a.delegate(msg)
}

func (a App) handleSelect(action string) (tea.Model, tea.Cmd) {
	switch action {
	case ActionQuit:
		return a, tea.Quit
	case ActionInstall:
		a.screen = scrRunning
		return a, tea.Batch(a.spinner.Tick, runAction("Install", a.actions.InstallPlugin))
	case ActionDoctor:
		a.result = resultMsg{title: "Tool check", output: a.actions.DoctorReport()}
		a.screen = scrResult
		return a, nil
	case ActionFix:
		a.toggle = NewToggle("Tools — check any to install", a.actions.ToolItems())
		a.toggleKind = "tools"
		a.screen = scrTools
		return a, nil
	case ActionMCP:
		a.toggle = NewToggle("MCP servers", a.actions.MCPItems())
		a.toggleKind = "mcp"
		a.screen = scrMCP
		return a, nil
	case ActionConfig:
		a.form = NewConfigForm("Configure orc", a.actions.ConfigFields())
		a.formKind = "config"
		a.screen = scrConfig
		return a, a.form.Init()
	case ActionInit:
		a.form = NewConfigForm("Init .orc (personalize config)", a.actions.InitFields())
		a.formKind = "init"
		a.screen = scrConfig
		return a, a.form.Init()
	}
	return a, nil
}

func (a App) delegate(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var m tea.Model
	switch a.screen {
	case scrMenu:
		m, cmd = a.menu.Update(msg)
		a.menu = m.(MenuModel)
	case scrTools, scrMCP:
		m, cmd = a.toggle.Update(msg)
		a.toggle = m.(ToggleModel)
	case scrConfig:
		m, cmd = a.form.Update(msg)
		a.form = m.(ConfigModel)
	}
	return a, cmd
}

// runAction wraps a side-effecting callback as a tea.Cmd producing a resultMsg.
func runAction(title string, fn func() (string, error)) tea.Cmd {
	return func() tea.Msg {
		out, err := fn()
		return resultMsg{title: title, output: out, err: err}
	}
}

var (
	appFrame    = lipgloss.NewStyle().Padding(1, 2)
	resultTitle = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
	resultErr   = lipgloss.NewStyle().Foreground(colorDanger).Bold(true)
	resultOK    = lipgloss.NewStyle().Foreground(colorSuccess).Bold(true)
	hintStyle   = lipgloss.NewStyle().Foreground(colorMuted).Padding(1, 0, 0, 0)
)

func (a App) View() string {
	var body string
	switch a.screen {
	case scrMenu:
		return a.menu.View() // menu already renders the banner + list full-screen
	case scrTools, scrMCP:
		body = a.toggle.View()
	case scrConfig:
		body = a.form.View()
	case scrRunning:
		body = a.spinner.View() + " Working…"
	case scrResult:
		body = a.renderResult()
	}
	return appFrame.Render(body)
}

func (a App) renderResult() string {
	var b strings.Builder
	b.WriteString(resultTitle.Render(a.result.title))
	b.WriteString("\n\n")
	if a.result.err != nil {
		b.WriteString(resultErr.Render("✖ " + a.result.err.Error()))
		b.WriteString("\n\n")
	}
	out := strings.TrimRight(a.result.output, "\n")
	if out == "" && a.result.err == nil {
		out = resultOK.Render("✓ Done.")
	}
	b.WriteString(out)
	b.WriteString("\n")
	b.WriteString(hintStyle.Render("press enter to return to the menu"))
	return b.String()
}

// Run starts the application in the alt-screen.
func Run(actions Actions, startAction string) error {
	_, err := tea.NewProgram(NewApp(actions, startAction), tea.WithAltScreen()).Run()
	return err
}
