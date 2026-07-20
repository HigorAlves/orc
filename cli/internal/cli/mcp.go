package cli

import (
	"fmt"
	"os"

	"github.com/HigorAlves/orc/cli/internal/claudecli"
	"github.com/HigorAlves/orc/cli/internal/mcp"
	"github.com/spf13/cobra"
)

func newMCPCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mcp",
		Short: "Manage MCP servers for Claude Code",
		Long: "Add, list, and remove MCP servers via the claude CLI. `orc mcp add <name>`\n" +
			"expands known servers (see `orc mcp known`) to a full invocation; unknown\n" +
			"names and extra args pass through to `claude mcp add`.",
	}
	cmd.AddCommand(newMCPListCmd(), newMCPAddCmd(), newMCPRemoveCmd(), newMCPKnownCmd())
	return cmd
}

func requireClaude() error {
	if !claudecli.Available() {
		return fmt.Errorf("the claude CLI is required for MCP management but was not found on PATH")
	}
	return nil
}

func newMCPListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List configured MCP servers",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireClaude(); err != nil {
				return err
			}
			return claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), "mcp", "list")
		},
	}
}

func newMCPKnownCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "known",
		Short: "List MCP servers orc knows how to add by name",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			for _, s := range mcp.All() {
				cmd.Printf("%-12s %s\n", s.Name, s.Description)
			}
			return nil
		},
	}
}

func newMCPAddCmd() *cobra.Command {
	var token string
	cmd := &cobra.Command{
		Use:   "add <name> [-- extra claude mcp add args]",
		Short: "Add an MCP server (known name or pass-through to claude)",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireClaude(); err != nil {
				return err
			}
			name := args[0]
			extra := args[1:]

			mcpArgs := []string{"mcp", "add"}
			if server, ok := mcp.Lookup(name); ok {
				if token == "" && server.TokenEnv != "" {
					token = os.Getenv(server.TokenEnv)
				}
				built, err := server.BuildArgs(token)
				if err != nil {
					return err
				}
				mcpArgs = append(mcpArgs, built...)
				mcpArgs = append(mcpArgs, extra...)
			} else {
				// Unknown name: pass straight through to the claude CLI.
				mcpArgs = append(mcpArgs, name)
				mcpArgs = append(mcpArgs, extra...)
			}
			return claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), mcpArgs...)
		},
	}
	cmd.Flags().StringVar(&token, "token", "", "auth token for servers that need one (e.g. github)")
	return cmd
}

func newMCPRemoveCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "remove <name>",
		Short: "Remove a configured MCP server",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireClaude(); err != nil {
				return err
			}
			return claudecli.Run(cmd.OutOrStdout(), cmd.ErrOrStderr(), "mcp", "remove", args[0])
		},
	}
}
