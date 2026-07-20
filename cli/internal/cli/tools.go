package cli

import "github.com/spf13/cobra"

func newToolsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "tools",
		Short: "Toggle which runtime tools to install interactively",
		Long: "Shows orc's runtime tools as a checklist (installed ones are locked) and\n" +
			"installs any you check via your package manager. For a non-interactive\n" +
			"check/fix, use `orc doctor` / `orc doctor --fix`.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return toolsManage(cmd.OutOrStdout(), cmd.ErrOrStderr())
		},
	}
}
