package cli

import (
	"fmt"

	"github.com/HigorAlves/orc/cli/internal/deps"
	"github.com/HigorAlves/orc/cli/internal/doctor"
	"github.com/HigorAlves/orc/cli/internal/platform"
	"github.com/spf13/cobra"
)

func newDoctorCmd() *cobra.Command {
	var asJSON bool
	var strict bool

	cmd := &cobra.Command{
		Use:   "doctor",
		Short: "Check which orc runtime tools are installed",
		Long: "Checks the CLI tools orc relies on (git, jq required; gh, agent-browser,\n" +
			"acli, docker recommended) and reports what's missing with install hints.\n\n" +
			"Exit code is non-zero when a required tool is missing (add --strict to also\n" +
			"fail on missing recommended tools).",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			reg, err := deps.Load()
			if err != nil {
				return err
			}
			d := platform.Detect()
			rep := reg.Check(d.Has)

			if asJSON {
				b, err := doctor.RenderJSON(rep, d.Platform())
				if err != nil {
					return err
				}
				cmd.Println(string(b))
			} else {
				cmd.Println(doctor.Render(rep, d.Platform()))
			}

			if len(rep.MissingRequired()) > 0 {
				return failf(cmd, "missing required tools")
			}
			if strict && len(rep.MissingRecommended()) > 0 {
				return failf(cmd, "missing recommended tools (--strict)")
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&asJSON, "json", false, "output machine-readable JSON")
	cmd.Flags().BoolVar(&strict, "strict", false, "also fail when recommended tools are missing")
	return cmd
}

// failf returns an error that carries a non-zero exit without re-printing usage.
func failf(cmd *cobra.Command, format string, a ...any) error {
	return fmt.Errorf(format, a...)
}
