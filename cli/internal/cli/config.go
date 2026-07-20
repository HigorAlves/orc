package cli

import (
	"github.com/HigorAlves/orc/cli/internal/config"
	"github.com/HigorAlves/orc/cli/internal/settings"
	"github.com/HigorAlves/orc/cli/internal/tui"
	"github.com/spf13/cobra"
)

func newConfigCmd() *cobra.Command {
	var settingsPath string

	cmd := &cobra.Command{
		Use:   "config",
		Short: "View and edit orc tunables",
		Long: "Reads and writes orc's tunables as ORC_* variables in the settings.json\n" +
			"\"env\" block. With no subcommand, lists every option and its current value.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			doc, err := loadSettings(settingsPath)
			if err != nil {
				return err
			}
			current, err := config.Get(doc)
			if err != nil {
				return err
			}
			for _, o := range config.Options {
				val, set := current[o.Key]
				if !set {
					val = "(unset)"
				}
				cmd.Printf("%-20s %-10s %s\n", o.Key, val, o.Desc)
			}
			return nil
		},
	}
	cmd.PersistentFlags().StringVar(&settingsPath, "settings", "", "path to settings.json (default ~/.claude/settings.json)")

	cmd.AddCommand(newConfigGetCmd(&settingsPath), newConfigSetCmd(&settingsPath), newConfigUnsetCmd(&settingsPath), newConfigEditCmd())
	return cmd
}

func newConfigEditCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "edit",
		Short: "Edit tunables in an interactive form",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return requireTTY(tui.ActionConfig)
		},
	}
}

func loadSettings(override string) (*settings.Doc, error) {
	path, err := resolveSettingsPath(override)
	if err != nil {
		return nil, err
	}
	return settings.Load(path)
}

func newConfigGetCmd(settingsPath *string) *cobra.Command {
	return &cobra.Command{
		Use:   "get <key>",
		Short: "Print one option's current value",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if _, ok := config.Lookup(args[0]); !ok {
				return failf(cmd, "unknown config key %q", args[0])
			}
			doc, err := loadSettings(*settingsPath)
			if err != nil {
				return err
			}
			current, err := config.Get(doc)
			if err != nil {
				return err
			}
			if v, ok := current[args[0]]; ok {
				cmd.Println(v)
			} else {
				cmd.Println("(unset)")
			}
			return nil
		},
	}
}

func newConfigSetCmd(settingsPath *string) *cobra.Command {
	return &cobra.Command{
		Use:   "set <key> <value>",
		Short: "Set an option",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			doc, err := loadSettings(*settingsPath)
			if err != nil {
				return err
			}
			if err := config.Set(doc, args[0], args[1]); err != nil {
				return err
			}
			if err := doc.Save(); err != nil {
				return err
			}
			cmd.Printf("✅ %s set (backup: %s.bak)\n", args[0], doc.Path())
			return nil
		},
	}
}

func newConfigUnsetCmd(settingsPath *string) *cobra.Command {
	return &cobra.Command{
		Use:   "unset <key>",
		Short: "Clear an option (restores its default)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			doc, err := loadSettings(*settingsPath)
			if err != nil {
				return err
			}
			removed, err := config.Unset(doc, args[0])
			if err != nil {
				return err
			}
			if !removed {
				cmd.Printf("%s was not set.\n", args[0])
				return nil
			}
			if err := doc.Save(); err != nil {
				return err
			}
			cmd.Printf("✅ %s cleared (backup: %s.bak)\n", args[0], doc.Path())
			return nil
		},
	}
}
