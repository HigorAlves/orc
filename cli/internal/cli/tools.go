package cli

import (
	"github.com/HigorAlves/orc/cli/internal/tui"
	"github.com/spf13/cobra"
)

func newToolsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "tools",
		Short: "Toggle which runtime tools to install interactively",
		Long: "Opens the interactive tools checklist (installed ones are locked) and\n" +
			"installs any you check. For a non-interactive check/fix, use\n" +
			"`orc doctor` / `orc doctor --fix`.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return requireTTY(tui.ActionFix)
		},
	}
}
