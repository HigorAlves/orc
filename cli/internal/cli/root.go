// Package cli wires the cobra command tree for the orc CLI.
package cli

import (
	"github.com/spf13/cobra"
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
		// With no subcommand and a TTY, this will launch the interactive TUI
		// (wired in a later step). Until then, show help.
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	root.AddCommand(newVersionCmd())
	root.AddCommand(newDoctorCmd())
	root.AddCommand(newInstallCmd())
	root.AddCommand(newUninstallCmd())
	root.AddCommand(newUpdateCmd())

	return root
}

// Execute runs the root command and returns its exit error.
func Execute() error {
	return NewRootCmd().Execute()
}
