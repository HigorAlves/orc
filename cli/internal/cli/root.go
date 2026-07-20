// Package cli wires the cobra command tree for the orc CLI.
package cli

import (
	"os"

	"github.com/HigorAlves/orc/cli/internal/tui"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

// NewRootCmd builds the root command with all subcommands attached.
// It is exported so tests can exercise the tree without a process boundary.
func NewRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "orc",
		Short:         "Install, doctor, and configure the orc Claude Code plugin",
		Long:          "orc streamlines installing the orc plugin, checking and installing its\nruntime tools, managing MCP servers, and editing its configuration.",
		SilenceUsage:  true,
		SilenceErrors: true,
		// With no subcommand: launch the interactive TUI on a TTY, otherwise
		// print help (so piped/non-interactive use is predictable).
		RunE: func(cmd *cobra.Command, args []string) error {
			if !interactive() {
				return cmd.Help()
			}
			choice, err := tui.RunMenu()
			if err != nil {
				return err
			}
			return dispatch(choice)
		},
	}

	root.AddCommand(newVersionCmd())
	root.AddCommand(newDoctorCmd())
	root.AddCommand(newInstallCmd())
	root.AddCommand(newUninstallCmd())
	root.AddCommand(newUpdateCmd())
	root.AddCommand(newMCPCmd())
	root.AddCommand(newConfigCmd())
	root.AddCommand(newToolsCmd())

	return root
}

// Execute runs the root command and returns its exit error.
func Execute() error {
	return NewRootCmd().Execute()
}

// interactive reports whether both stdin and stdout are terminals, so the TUI
// only launches when it can actually be driven and rendered.
func interactive() bool {
	return term.IsTerminal(int(os.Stdin.Fd())) && term.IsTerminal(int(os.Stdout.Fd()))
}

// dispatch runs the command matching a menu choice. Each subcommand is executed
// with explicit args so it does not re-parse the (empty) top-level os.Args.
func dispatch(choice string) error {
	switch choice {
	case tui.ActionInstall:
		return runWithArgs(newInstallCmd())
	case tui.ActionDoctor:
		return runWithArgs(newDoctorCmd())
	case tui.ActionFix:
		return toolsManage(os.Stdout, os.Stderr)
	case tui.ActionConfig:
		return runWithArgs(newConfigCmd())
	case tui.ActionMCP:
		return mcpManage(os.Stdout, os.Stderr)
	default:
		return nil
	}
}

func runWithArgs(cmd *cobra.Command, args ...string) error {
	cmd.SetArgs(args)
	return cmd.Execute()
}
