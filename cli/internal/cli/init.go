package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/HigorAlves/orc/cli/internal/orcstate"
	"github.com/HigorAlves/orc/cli/internal/workspace"
	"github.com/spf13/cobra"
)

func newInitCmd() *cobra.Command {
	var budget int
	var excludeMigrations bool
	var excludes []string
	var force bool

	cmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize .orc state for this repo or workspace",
		Long: "Detects the context (repo / workspace), creates the .orc state directory\n" +
			"with an orc.json session registry, writes a personalized pr-budget.json\n" +
			"(PR size budget + exclusions), and gitignores .orc/. Mirrors what the orc\n" +
			"plugin expects at runtime.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			summary, err := runInit(orcstate.Options{
				Budget:             budget,
				ExcludeMigrations:  excludeMigrations,
				AdditionalExcludes: excludes,
				Force:              force,
			})
			if summary != "" {
				cmd.Println(summary)
			}
			return err
		},
	}
	cmd.Flags().IntVar(&budget, "budget", 0, "PR size budget (LOC); 0 uses the default 300")
	cmd.Flags().BoolVar(&excludeMigrations, "exclude-migrations", true, "exclude migration files from the PR budget")
	cmd.Flags().StringArrayVar(&excludes, "exclude", nil, "extra pathspec to exclude from the budget (repeatable)")
	cmd.Flags().BoolVar(&force, "force", false, "overwrite an existing pr-budget.json")
	return cmd
}

// runInit detects the context, initializes .orc, and returns a human summary.
func runInit(opts orcstate.Options) (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	ctx := workspace.Detect(cwd)
	if ctx.Kind == workspace.Loose {
		return "", fmt.Errorf("not a repo or workspace: run this inside a git repo, or a directory containing 2+ git repos")
	}

	root := ctx.RepoRoot
	if ctx.Kind == workspace.Workspace {
		root = ctx.WorkspaceRoot
	}

	res, err := orcstate.Init(ctx.StateDir, root, opts)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	fmt.Fprintf(&b, "✅ Initialized orc state (%s)\n", ctx.Kind)
	if ctx.Kind == workspace.Workspace {
		fmt.Fprintf(&b, "   Workspace: %s  [%s]\n", ctx.WorkspaceName, strings.Join(ctx.Repos, ", "))
	}
	fmt.Fprintf(&b, "   State dir: %s\n", res.StateDir)
	if res.CreatedOrcJSON {
		fmt.Fprintln(&b, "   orc.json:  created")
	} else {
		fmt.Fprintln(&b, "   orc.json:  kept existing")
	}
	if res.WrotePRBudget {
		bud := opts.Budget
		if bud <= 0 {
			bud = orcstate.DefaultBudget
		}
		fmt.Fprintf(&b, "   pr-budget: budget=%d exclude_migrations=%v excludes=%v\n", bud, opts.ExcludeMigrations, opts.AdditionalExcludes)
	} else {
		fmt.Fprintln(&b, "   pr-budget: kept existing (use --force to overwrite)")
	}
	if res.GitignoreUpdated {
		fmt.Fprintln(&b, "   .gitignore: added .orc/")
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

// readPRBudget returns the current pr-budget.json values for form prefill.
func readPRBudget(stateDir string) (budget int, excludeMigrations bool, excludes []string, ok bool) {
	b, err := os.ReadFile(filepath.Join(stateDir, "pr-budget.json"))
	if err != nil {
		return orcstate.DefaultBudget, true, nil, false
	}
	var pb struct {
		Budget             int      `json:"budget"`
		ExcludeMigrations  *bool    `json:"exclude_migrations"`
		AdditionalExcludes []string `json:"additional_excludes"`
	}
	if json.Unmarshal(b, &pb) != nil {
		return orcstate.DefaultBudget, true, nil, false
	}
	em := true
	if pb.ExcludeMigrations != nil {
		em = *pb.ExcludeMigrations
	}
	if pb.Budget == 0 {
		pb.Budget = orcstate.DefaultBudget
	}
	return pb.Budget, em, pb.AdditionalExcludes, true
}
