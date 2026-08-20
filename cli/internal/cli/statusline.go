package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

// statusLineValue mirrors the settings.json statusLine object shape.
type statusLineValue struct {
	Type    string `json:"type"`
	Command string `json:"command"`
}

// newStatusLineCmd manages a user-level statusLine pointing at the installed
// plugin's bin/orc-statusline. Escape hatch for the plugin-shipped default
// (orc/settings.json): user-level values win, and some setups prefer an
// explicit entry. Courtesy contract: never clobber a statusLine orc does not
// own unless --force is passed; uninstall removes only an orc-owned value.
func newStatusLineCmd() *cobra.Command {
	var settingsPath string
	var pluginDir string

	cmd := &cobra.Command{
		Use:   "statusline",
		Short: "Install, inspect, or remove the orc statusline",
		Long: "The orc plugin ships a default statusLine; this command manages an\n" +
			"explicit user-level entry instead (user settings always win). The\n" +
			"written command is an absolute path to the installed plugin's\n" +
			"bin/orc-statusline — re-run install after a plugin update if the\n" +
			"cache path changes.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return statusLineStatus(cmd, settingsPath, pluginDir)
		},
	}
	cmd.PersistentFlags().StringVar(&settingsPath, "settings", "", "path to settings.json (default ~/.claude/settings.json)")
	cmd.PersistentFlags().StringVar(&pluginDir, "plugin-dir", "", "plugin install dir containing bin/orc-statusline (default: newest ~/.claude/plugins/cache/orc/orc/<version>)")

	install := &cobra.Command{
		Use:   "install",
		Short: "Write the user-level statusLine entry",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			force, _ := cmd.Flags().GetBool("force")
			return statusLineInstall(cmd, settingsPath, pluginDir, force)
		},
	}
	install.Flags().Bool("force", false, "replace an existing non-orc statusLine")

	uninstall := &cobra.Command{
		Use:   "uninstall",
		Short: "Remove the statusLine entry if orc owns it",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return statusLineUninstall(cmd, settingsPath)
		},
	}

	status := &cobra.Command{
		Use:   "status",
		Short: "Show the current statusLine and whether orc owns it",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return statusLineStatus(cmd, settingsPath, pluginDir)
		},
	}

	cmd.AddCommand(install, uninstall, status)
	return cmd
}

func statusLineInstall(cmd *cobra.Command, settingsPath, pluginDir string, force bool) error {
	script, err := findStatuslineScript(pluginDir)
	if err != nil {
		return err
	}
	doc, err := loadSettings(settingsPath)
	if err != nil {
		return err
	}
	var existing statusLineValue
	if ok, err := doc.Unmarshal("statusLine", &existing); err == nil && ok {
		if !strings.Contains(existing.Command, "orc-statusline") && !force {
			return failf(cmd, "a statusLine is already configured (%q) and orc does not own it — keeping it; pass --force to replace", existing.Command)
		}
	}
	if err := doc.Set("statusLine", statusLineValue{Type: "command", Command: script}); err != nil {
		return err
	}
	if err := doc.Save(); err != nil {
		return err
	}
	cmd.Printf("✅ statusLine → %s (in %s)\n", script, doc.Path())
	return nil
}

func statusLineUninstall(cmd *cobra.Command, settingsPath string) error {
	doc, err := loadSettings(settingsPath)
	if err != nil {
		return err
	}
	var existing statusLineValue
	ok, err := doc.Unmarshal("statusLine", &existing)
	if err != nil {
		return err
	}
	if !ok {
		cmd.Println("no statusLine configured — nothing to remove")
		return nil
	}
	if !strings.Contains(existing.Command, "orc-statusline") {
		return failf(cmd, "the configured statusLine (%q) is not orc's — refusing to remove it", existing.Command)
	}
	doc.Delete("statusLine")
	if err := doc.Save(); err != nil {
		return err
	}
	cmd.Printf("✅ removed the orc statusLine from %s\n", doc.Path())
	return nil
}

func statusLineStatus(cmd *cobra.Command, settingsPath, pluginDir string) error {
	doc, err := loadSettings(settingsPath)
	if err != nil {
		return err
	}
	var existing statusLineValue
	ok, err := doc.Unmarshal("statusLine", &existing)
	if err != nil {
		return err
	}
	switch {
	case !ok:
		cmd.Println("statusLine: none configured at the user level (the plugin-shipped default applies while orc is enabled)")
	case strings.Contains(existing.Command, "orc-statusline"):
		cmd.Printf("statusLine: orc-owned → %s\n", existing.Command)
		if fields := strings.Fields(existing.Command); len(fields) > 0 {
			if _, statErr := os.Stat(fields[0]); statErr != nil {
				cmd.Println("⚠ the script path no longer exists (plugin updated?) — re-run `orc statusline install`")
			}
		}
	default:
		cmd.Printf("statusLine: third-party → %s (orc keeps its hands off; --force on install replaces it)\n", existing.Command)
	}
	if script, err := findStatuslineScript(pluginDir); err == nil {
		cmd.Printf("plugin script: %s\n", script)
	}
	return nil
}

// findStatuslineScript resolves the installed plugin's bin/orc-statusline.
// Default search root is the newest version under the Claude plugin cache;
// pluginDir overrides for tests and unusual layouts.
func findStatuslineScript(pluginDir string) (string, error) {
	if pluginDir != "" {
		p := filepath.Join(pluginDir, "bin", "orc-statusline")
		if _, err := os.Stat(p); err != nil {
			return "", fmt.Errorf("no bin/orc-statusline under %s", pluginDir)
		}
		return p, nil
	}
	base := os.Getenv("CLAUDE_CONFIG_DIR")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, ".claude")
	}
	cache := filepath.Join(base, "plugins", "cache", "orc", "orc")
	entries, err := os.ReadDir(cache)
	if err != nil {
		return "", fmt.Errorf("orc plugin cache not found at %s — is the plugin installed? (%w)", cache, err)
	}
	var versions []string
	for _, e := range entries {
		if e.IsDir() {
			if _, err := os.Stat(filepath.Join(cache, e.Name(), "bin", "orc-statusline")); err == nil {
				versions = append(versions, e.Name())
			}
		}
	}
	if len(versions) == 0 {
		return "", fmt.Errorf("no installed orc version under %s ships bin/orc-statusline — update the plugin first", cache)
	}
	sort.Slice(versions, func(i, j int) bool { return semverLess(versions[i], versions[j]) })
	return filepath.Join(cache, versions[len(versions)-1], "bin", "orc-statusline"), nil
}

// semverLess orders dotted numeric version strings; non-numeric segments
// fall back to string comparison so unexpected names still sort stably.
func semverLess(a, b string) bool {
	as, bs := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < len(as) || i < len(bs); i++ {
		var av, bv string
		if i < len(as) {
			av = as[i]
		}
		if i < len(bs) {
			bv = bs[i]
		}
		an, aerr := strconv.Atoi(av)
		bn, berr := strconv.Atoi(bv)
		if aerr == nil && berr == nil {
			if an != bn {
				return an < bn
			}
			continue
		}
		if av != bv {
			return av < bv
		}
	}
	return false
}
