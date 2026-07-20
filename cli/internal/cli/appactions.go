package cli

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"github.com/HigorAlves/orc/cli/internal/claudecli"
	"github.com/HigorAlves/orc/cli/internal/config"
	"github.com/HigorAlves/orc/cli/internal/deps"
	"github.com/HigorAlves/orc/cli/internal/doctor"
	"github.com/HigorAlves/orc/cli/internal/mcp"
	"github.com/HigorAlves/orc/cli/internal/pkgmgr"
	"github.com/HigorAlves/orc/cli/internal/platform"
	"github.com/HigorAlves/orc/cli/internal/plugin"
	"github.com/HigorAlves/orc/cli/internal/settings"
	"github.com/HigorAlves/orc/cli/internal/tui"
)

// buildActions wires the TUI's injected callbacks. Every Apply* captures its
// output (rather than streaming to os.Stdout, which would corrupt the alt-screen)
// so the result screen can show it.
func buildActions() tui.Actions {
	return tui.Actions{
		InstallPlugin: installPluginAction,
		DoctorReport:  doctorReportAction,
		ToolItems:     toolItems,
		ApplyTools:    applyToolsAction,
		MCPItems:      mcpItems,
		ApplyMCP:      applyMCPAction,
		ConfigFields:  configFields,
		ApplyConfig:   applyConfigAction,
	}
}

func doctorReportAction() string {
	reg, err := deps.Load()
	if err != nil {
		return err.Error()
	}
	d := platform.Detect()
	return doctor.Render(reg.Check(d.Has), d.Platform())
}

func installPluginAction() (string, error) {
	var b strings.Builder
	if claudecli.Available() {
		o, err := claudecli.Output("plugin", "marketplace", "add", plugin.RepoSlug)
		fmt.Fprintf(&b, "$ claude plugin marketplace add %s\n%s\n", plugin.RepoSlug, strings.TrimSpace(o))
		if err != nil {
			return b.String(), err
		}
		o, err = claudecli.Output("plugin", "install", plugin.PluginID)
		fmt.Fprintf(&b, "$ claude plugin install %s\n%s\n", plugin.PluginID, strings.TrimSpace(o))
		if err != nil {
			return b.String(), err
		}
		b.WriteString("\n✅ Restart Claude Code (or /reload-plugins) to load orc.")
		return b.String(), nil
	}

	path, err := resolveSettingsPath("")
	if err != nil {
		return "", err
	}
	doc, err := settings.Load(path)
	if err != nil {
		return "", err
	}
	if err := plugin.Install(doc, plugin.InstallOptions{}); err != nil {
		return "", err
	}
	if err := doc.Save(); err != nil {
		return "", err
	}
	fmt.Fprintf(&b, "✅ Wrote orc entries to %s (backup: %s.bak)\nRestart Claude Code to load it.", path, path)
	return b.String(), nil
}

func toolItems() []tui.ToggleItem {
	reg, _ := deps.Load()
	d := platform.Detect()
	items := make([]tui.ToggleItem, 0, len(reg.Tools))
	for _, t := range reg.Tools {
		installed := d.Has(t.Name)
		items = append(items, tui.ToggleItem{
			Key:    t.Name,
			Title:  fmt.Sprintf("%s (%s)", t.Name, t.Tier),
			Desc:   t.Hint(d.Platform()),
			On:     installed,
			Locked: installed,
		})
	}
	return items
}

func applyToolsAction(desiredOn map[string]bool) (string, error) {
	reg, err := deps.Load()
	if err != nil {
		return "", err
	}
	d := platform.Detect()
	sysMgr := d.PackageManager()
	hasNpm := d.Has("npm")

	var b strings.Builder
	n := 0
	for _, t := range reg.Tools {
		if !desiredOn[t.Name] || d.Has(t.Name) {
			continue // only newly-checked, missing tools
		}
		cmd, ok := pkgmgr.Resolve(t, sysMgr, hasNpm)
		if !ok {
			fmt.Fprintf(&b, "• %s — no unattended install; run: %s\n", t.Name, t.Hint(d.Platform()))
			continue
		}
		n++
		fmt.Fprintf(&b, "• %s — %s\n", t.Name, cmd.String())
		var buf bytes.Buffer
		if e := cmd.Run(&buf, &buf); e != nil {
			fmt.Fprintf(&b, "  failed: %v\n%s\n", e, strings.TrimSpace(buf.String()))
		} else {
			fmt.Fprintf(&b, "  installed.\n")
		}
	}
	if n == 0 {
		b.WriteString("Nothing to install.")
	}
	return b.String(), nil
}

func mcpItems() []tui.ToggleItem {
	configured := map[string]bool{}
	if claudecli.Available() {
		out, _ := claudecli.Output("mcp", "list")
		for _, name := range mcp.ParseConfigured(out) {
			configured[name] = true
		}
	}
	items := make([]tui.ToggleItem, 0, len(mcp.All()))
	for _, s := range mcp.All() {
		items = append(items, tui.ToggleItem{
			Key:   s.Name,
			Title: s.Name,
			Desc:  s.Description,
			On:    configured[s.Name],
		})
	}
	return items
}

func applyMCPAction(desiredOn map[string]bool) (string, error) {
	if !claudecli.Available() {
		return "", fmt.Errorf("the claude CLI is required for MCP management")
	}
	cur := map[string]bool{}
	out, _ := claudecli.Output("mcp", "list")
	for _, name := range mcp.ParseConfigured(out) {
		cur[name] = true
	}

	var b strings.Builder
	n := 0
	for _, s := range mcp.All() {
		want, have := desiredOn[s.Name], cur[s.Name]
		switch {
		case want && !have:
			n++
			token := ""
			if s.NeedsToken && s.TokenEnv != "" {
				token = os.Getenv(s.TokenEnv)
			}
			args, e := s.BuildArgs(token)
			if e != nil {
				fmt.Fprintf(&b, "• %s — skipped: %v\n", s.Name, e)
				continue
			}
			o, e := claudecli.Output(append([]string{"mcp", "add"}, args...)...)
			fmt.Fprintf(&b, "• add %s\n%s\n", s.Name, strings.TrimSpace(o))
			if e != nil {
				fmt.Fprintf(&b, "  (error: %v)\n", e)
			}
		case !want && have:
			n++
			o, e := claudecli.Output("mcp", "remove", s.Name)
			fmt.Fprintf(&b, "• remove %s\n%s\n", s.Name, strings.TrimSpace(o))
			if e != nil {
				fmt.Fprintf(&b, "  (error: %v)\n", e)
			}
		}
	}
	if n == 0 {
		b.WriteString("No changes.")
	}
	return b.String(), nil
}

func toFieldKind(k config.Kind) tui.FieldKind {
	switch k {
	case config.KindBool:
		return tui.FieldBool
	case config.KindInt:
		return tui.FieldInt
	default:
		return tui.FieldString
	}
}

func configFields() []tui.ConfigField {
	doc, err := loadSettings("")
	current := map[string]string{}
	if err == nil {
		current, _ = config.Get(doc)
	}
	fields := make([]tui.ConfigField, 0, len(config.Options))
	for _, o := range config.Options {
		fields = append(fields, tui.ConfigField{
			Key:   o.Key,
			Label: o.Key,
			Desc:  o.Desc,
			Kind:  toFieldKind(o.Kind),
			Value: current[o.Key],
		})
	}
	return fields
}

func applyConfigAction(values map[string]string) (string, error) {
	doc, err := loadSettings("")
	if err != nil {
		return "", err
	}
	var b strings.Builder
	changed := 0
	for _, o := range config.Options {
		v, ok := values[o.Key]
		if !ok {
			continue
		}
		if o.Kind != config.KindBool && strings.TrimSpace(v) == "" {
			if removed, e := config.Unset(doc, o.Key); e != nil {
				fmt.Fprintf(&b, "• %s — %v\n", o.Key, e)
			} else if removed {
				changed++
				fmt.Fprintf(&b, "• %s cleared\n", o.Key)
			}
			continue
		}
		if e := config.Set(doc, o.Key, v); e != nil {
			fmt.Fprintf(&b, "• %s — %v\n", o.Key, e)
			continue
		}
		changed++
		fmt.Fprintf(&b, "• %s = %s\n", o.Key, v)
	}
	if changed > 0 {
		if e := doc.Save(); e != nil {
			return b.String(), e
		}
		fmt.Fprintf(&b, "\nSaved to %s (backup: %s.bak)", doc.Path(), doc.Path())
	}
	return b.String(), nil
}
