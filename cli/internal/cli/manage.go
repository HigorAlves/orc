package cli

import (
	"fmt"
	"io"
	"os"

	"github.com/HigorAlves/orc/cli/internal/claudecli"
	"github.com/HigorAlves/orc/cli/internal/deps"
	"github.com/HigorAlves/orc/cli/internal/mcp"
	"github.com/HigorAlves/orc/cli/internal/pkgmgr"
	"github.com/HigorAlves/orc/cli/internal/platform"
	"github.com/HigorAlves/orc/cli/internal/tui"
)

// mcpManage shows a toggle screen of the curated MCP servers (checked =
// currently configured) and applies the diff via the claude CLI: adding newly
// checked servers and removing unchecked ones.
func mcpManage(out, errw io.Writer) error {
	if !claudecli.Available() {
		return fmt.Errorf("the claude CLI is required for MCP management but was not found on PATH")
	}

	listing, _ := claudecli.Output("mcp", "list") // best-effort; empty on first run
	configured := map[string]bool{}
	for _, n := range mcp.ParseConfigured(listing) {
		configured[n] = true
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

	final, err := tui.RunToggle("MCP servers", items)
	if err != nil {
		return err
	}
	if !final.Confirmed {
		fmt.Fprintln(out, "No changes.")
		return nil
	}

	changed := 0
	for _, it := range final.Items {
		was := configured[it.Key]
		switch {
		case it.On && !was:
			changed++
			server, _ := mcp.Lookup(it.Key)
			token := ""
			if server.NeedsToken && server.TokenEnv != "" {
				token = os.Getenv(server.TokenEnv)
			}
			args, berr := server.BuildArgs(token)
			if berr != nil {
				fmt.Fprintf(out, "• %s — skipped: %v\n", it.Key, berr)
				continue
			}
			fmt.Fprintf(out, "• adding %s…\n", it.Key)
			if e := claudecli.Run(out, errw, append([]string{"mcp", "add"}, args...)...); e != nil {
				fmt.Fprintf(out, "  failed: %v\n", e)
			}
		case !it.On && was:
			changed++
			fmt.Fprintf(out, "• removing %s…\n", it.Key)
			if e := claudecli.Run(out, errw, "mcp", "remove", it.Key); e != nil {
				fmt.Fprintf(out, "  failed: %v\n", e)
			}
		}
	}
	if changed == 0 {
		fmt.Fprintln(out, "No changes.")
	}
	return nil
}

// toolsManage shows a toggle screen of orc's runtime tools (installed ones are
// checked and locked) and installs any newly checked tools via the host package
// manager.
func toolsManage(out, errw io.Writer) error {
	reg, err := deps.Load()
	if err != nil {
		return err
	}
	d := platform.Detect()

	items := make([]tui.ToggleItem, 0, len(reg.Tools))
	for _, tool := range reg.Tools {
		installed := d.Has(tool.Name)
		items = append(items, tui.ToggleItem{
			Key:    tool.Name,
			Title:  fmt.Sprintf("%s (%s)", tool.Name, tool.Tier),
			Desc:   tool.Hint(d.Platform()),
			On:     installed,
			Locked: installed, // already-installed tools can't be removed from here
		})
	}

	final, err := tui.RunToggle("Tools — check any to install", items)
	if err != nil {
		return err
	}
	if !final.Confirmed {
		fmt.Fprintln(out, "No changes.")
		return nil
	}

	sysMgr := d.PackageManager()
	hasNpm := d.Has("npm")
	installed := 0
	for _, it := range final.Items {
		if it.Locked || !it.On {
			continue // only newly-checked, missing tools
		}
		tool, ok := findTool(reg, it.Key)
		if !ok {
			continue
		}
		cmd, ok := pkgmgr.Resolve(tool, sysMgr, hasNpm)
		if !ok {
			fmt.Fprintf(out, "• %s — no unattended install; run: %s\n", it.Key, tool.Hint(d.Platform()))
			continue
		}
		installed++
		fmt.Fprintf(out, "• %s — %s\n", it.Key, cmd.String())
		if e := cmd.Run(out, errw); e != nil {
			fmt.Fprintf(out, "  failed: %v\n", e)
		} else {
			fmt.Fprintf(out, "  installed %s.\n", it.Key)
		}
	}
	if installed == 0 {
		fmt.Fprintln(out, "Nothing to install.")
	}
	return nil
}

func findTool(reg deps.Registry, name string) (deps.Tool, bool) {
	for _, t := range reg.Tools {
		if t.Name == name {
			return t, true
		}
	}
	return deps.Tool{}, false
}
