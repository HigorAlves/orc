package cli

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var runCodex = func(cmd *cobra.Command, args ...string) error {
	child := exec.Command("codex", args...)
	child.Stdin, child.Stdout, child.Stderr = os.Stdin, cmd.OutOrStdout(), cmd.ErrOrStderr()
	return child.Run()
}

func codexAction(cmd *cobra.Command, action, ref string) error {
	for _, flag := range []string{"settings", "settings-only"} {
		if cmd.Flags().Changed(flag) {
			return fmt.Errorf("--%s is only supported with --host claude", flag)
		}
	}
	switch action {
	case "install", "update":
		args := []string{"plugin", "marketplace", "add", "https://github.com/HigorAlves/orc.git"}
		if ref != "" {
			args = append(args, "--ref", ref)
		}
		if action == "update" && ref == "" {
			args = []string{"plugin", "marketplace", "upgrade", "orc-codex"}
		}
		if err := runCodex(cmd, args...); err != nil {
			return fmt.Errorf("codex marketplace: %w", err)
		}
		if err := runCodex(cmd, "plugin", "add", "orc@orc-codex"); err != nil {
			return fmt.Errorf("codex plugin: %w", err)
		}
		cmd.Println("orc enabled for Codex. Restart the app or start a new CLI session. Review plugin hook trust before use.")
	case "uninstall":
		if err := runCodex(cmd, "plugin", "remove", "orc@orc-codex"); err != nil {
			return err
		}
		cmd.Println("orc removed from Codex. Marketplace registration retained for future installs.")
	}
	return nil
}

func validateHost(host string) error {
	if host != "claude" && host != "codex" {
		return fmt.Errorf("unknown host %q: use claude or codex", host)
	}
	return nil
}

func newPluginStatusCmd() *cobra.Command {
	var host string
	cmd := &cobra.Command{
		Use:   "status",
		Short: "List installed plugins for the selected host",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := validateHost(host); err != nil {
				return err
			}
			if host == "codex" {
				return runCodex(cmd, "plugin", "list")
			}
			child := exec.Command("claude", "plugin", "list")
			child.Stdin, child.Stdout, child.Stderr = os.Stdin, cmd.OutOrStdout(), cmd.ErrOrStderr()
			return child.Run()
		},
	}
	cmd.Flags().StringVar(&host, "host", "claude", "plugin host: claude or codex")
	return cmd
}
