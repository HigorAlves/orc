package cli

import (
	"fmt"

	"github.com/HigorAlves/orc/cli/internal/deps"
	"github.com/HigorAlves/orc/cli/internal/doctor"
	"github.com/HigorAlves/orc/cli/internal/pkgmgr"
	"github.com/HigorAlves/orc/cli/internal/platform"
	"github.com/spf13/cobra"
)

func newDoctorCmd() *cobra.Command {
	var asJSON bool
	var strict bool
	var fix bool
	var yes bool

	cmd := &cobra.Command{
		Use:   "doctor",
		Short: "Check (and optionally install) the orc runtime tools",
		Long: "Checks the CLI tools orc relies on (git, jq required; gh, agent-browser,\n" +
			"acli, docker recommended) and reports what's missing with install hints.\n\n" +
			"With --fix, resolves an install command per missing tool from the host's\n" +
			"package manager (brew/apt/dnf/pacman, or npm) and runs it after you confirm\n" +
			"(--yes to skip prompts). Tools with no unattended recipe print their hint.\n\n" +
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
				return doctorExit(cmd, rep, strict)
			}

			cmd.Println(doctor.Render(rep, d.Platform()))

			if fix {
				missing := append(append([]deps.Status{}, rep.MissingRequired()...), rep.MissingRecommended()...)
				if len(missing) > 0 {
					cmd.Println()
					fixMissing(cmd, missing, d, yes)
					// Re-check so the exit code and summary reflect what's now installed.
					rep = reg.Check(platform.Detect().Has)
				}
			}

			return doctorExit(cmd, rep, strict)
		},
	}
	cmd.Flags().BoolVar(&asJSON, "json", false, "output machine-readable JSON")
	cmd.Flags().BoolVar(&strict, "strict", false, "also fail when recommended tools are missing")
	cmd.Flags().BoolVar(&fix, "fix", false, "install missing tools via the host package manager")
	cmd.Flags().BoolVarP(&yes, "yes", "y", false, "skip confirmation prompts (with --fix)")
	return cmd
}

func fixMissing(cmd *cobra.Command, missing []deps.Status, d platform.Detector, yes bool) {
	sysMgr := d.PackageManager()
	hasNpm := d.Has("npm")
	platformID := d.Platform()

	for _, s := range missing {
		install, ok := pkgmgr.Resolve(s.Tool, sysMgr, hasNpm)
		if !ok {
			cmd.Printf("• %s — no unattended install; run: %s\n", s.Tool.Name, s.Tool.Hint(platformID))
			continue
		}
		cmd.Printf("• %s — %s\n", s.Tool.Name, install.String())
		if !yes && !confirm(cmd, "  Run this now?") {
			cmd.Println("  skipped.")
			continue
		}
		if err := install.Run(cmd.OutOrStdout(), cmd.ErrOrStderr()); err != nil {
			cmd.Printf("  failed: %v\n", err)
		} else {
			cmd.Printf("  installed %s.\n", s.Tool.Name)
		}
	}
}

func doctorExit(cmd *cobra.Command, rep deps.Report, strict bool) error {
	if len(rep.MissingRequired()) > 0 {
		return failf(cmd, "missing required tools")
	}
	if strict && len(rep.MissingRecommended()) > 0 {
		return failf(cmd, "missing recommended tools (--strict)")
	}
	return nil
}

// failf returns an error that carries a non-zero exit without re-printing usage.
func failf(cmd *cobra.Command, format string, a ...any) error {
	return fmt.Errorf(format, a...)
}
