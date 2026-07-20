package cli

import (
	"fmt"

	"github.com/HigorAlves/orc/cli/internal/claudecli"
	"github.com/HigorAlves/orc/cli/internal/plugin"
	"github.com/HigorAlves/orc/cli/internal/settings"
	"github.com/spf13/cobra"
)

func newInstallCmd() *cobra.Command {
	var ref string
	var settingsOnly bool
	var settingsPath string

	cmd := &cobra.Command{
		Use:   "install",
		Short: "Register the orc marketplace and enable the plugin",
		Long: "Installs the orc Claude Code plugin.\n\n" +
			"By default this drives the `claude` CLI (marketplace add + install). Use\n" +
			"--ref to pin a version or --settings-only to write ~/.claude/settings.json\n" +
			"directly (offline; also used automatically when the claude CLI is absent).",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			useSettings := settingsOnly || ref != "" || !claudecli.Available()

			if !useSettings {
				cmd.Println("Installing orc via the claude CLI…")
				if err := claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), "plugin", "marketplace", "add", plugin.RepoSlug); err != nil {
					return fmt.Errorf("claude plugin marketplace add: %w", err)
				}
				if err := claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), "plugin", "install", plugin.PluginID); err != nil {
					return fmt.Errorf("claude plugin install: %w", err)
				}
				cmd.Println("✅ orc installed. Restart Claude Code (or run /reload-plugins) to load it.")
				return nil
			}

			path, err := resolveSettingsPath(settingsPath)
			if err != nil {
				return err
			}
			doc, err := settings.Load(path)
			if err != nil {
				return err
			}
			if err := plugin.Install(doc, plugin.InstallOptions{Ref: ref}); err != nil {
				return err
			}
			if err := doc.Save(); err != nil {
				return err
			}

			pin := "latest"
			if ref != "" {
				pin = ref
			}
			cmd.Printf("✅ Wrote orc marketplace + enable entries (%s) to %s\n", pin, path)
			cmd.Printf("   Backup: %s.bak\n", path)
			cmd.Println("   Restart Claude Code (or run /plugin install orc@orc) to load it.")
			return nil
		},
	}
	cmd.Flags().StringVar(&ref, "ref", "", "pin a git tag or commit (implies --settings-only mechanism)")
	cmd.Flags().BoolVar(&settingsOnly, "settings-only", false, "write ~/.claude/settings.json directly instead of using the claude CLI")
	cmd.Flags().StringVar(&settingsPath, "settings", "", "path to settings.json (default ~/.claude/settings.json)")
	return cmd
}

func newUninstallCmd() *cobra.Command {
	var yes bool
	var settingsPath string

	cmd := &cobra.Command{
		Use:   "uninstall",
		Short: "Remove the orc plugin and marketplace entries",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if !yes && !confirm(cmd, "Remove orc's plugin + marketplace entries?") {
				cmd.Println("Aborted.")
				return nil
			}

			// Best-effort cleanup via the claude CLI (covers CLI-based installs).
			if claudecli.Available() {
				_ = claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), "plugin", "uninstall", plugin.PluginID)
				_ = claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), "plugin", "marketplace", "remove", plugin.MarketplaceName)
			}

			// Authoritative cleanup of anything we wrote to settings.json.
			path, err := resolveSettingsPath(settingsPath)
			if err != nil {
				return err
			}
			doc, err := settings.Load(path)
			if err != nil {
				return err
			}
			removed, err := plugin.Uninstall(doc)
			if err != nil {
				return err
			}
			if removed {
				if err := doc.Save(); err != nil {
					return err
				}
				cmd.Printf("✅ Removed orc entries from %s (backup: %s.bak)\n", path, path)
			} else {
				cmd.Println("No orc entries found in settings.json.")
			}
			return nil
		},
	}
	cmd.Flags().BoolVarP(&yes, "yes", "y", false, "skip the confirmation prompt")
	cmd.Flags().StringVar(&settingsPath, "settings", "", "path to settings.json (default ~/.claude/settings.json)")
	return cmd
}

func newUpdateCmd() *cobra.Command {
	var to string
	var settingsPath string

	cmd := &cobra.Command{
		Use:   "update",
		Short: "Update orc to the latest version (or repin with --to)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if to != "" {
				path, err := resolveSettingsPath(settingsPath)
				if err != nil {
					return err
				}
				doc, err := settings.Load(path)
				if err != nil {
					return err
				}
				if err := plugin.Install(doc, plugin.InstallOptions{Ref: to}); err != nil {
					return err
				}
				if err := doc.Save(); err != nil {
					return err
				}
				cmd.Printf("✅ Re-pinned orc to %s in %s (backup: %s.bak)\n", to, path, path)
				cmd.Println("   Restart Claude Code to apply.")
				return nil
			}

			if claudecli.Available() {
				cmd.Println("Updating orc via the claude CLI…")
				if err := claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), "plugin", "update", plugin.PluginID); err != nil {
					return fmt.Errorf("claude plugin update: %w", err)
				}
				cmd.Println("✅ Update requested. Restart Claude Code to apply.")
				return nil
			}
			cmd.Println("The claude CLI is not available. Run /plugin update orc@orc inside Claude Code,")
			cmd.Println("or pass --to <ref> to repin a version in settings.json.")
			return nil
		},
	}
	cmd.Flags().StringVar(&to, "to", "", "repin to a specific git tag or commit")
	cmd.Flags().StringVar(&settingsPath, "settings", "", "path to settings.json (default ~/.claude/settings.json)")
	return cmd
}

// resolveSettingsPath returns the override when set, else the default path.
func resolveSettingsPath(override string) (string, error) {
	if override != "" {
		return override, nil
	}
	return settings.DefaultPath()
}
