// Package orcstate initializes the .orc state directory the orc plugin uses —
// the session registry (orc.json) and the per-repo PR config (pr-budget.json) —
// matching the schemas the plugin reads.
package orcstate

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DefaultBudget is the plugin's default PR size budget.
const DefaultBudget = 300

// Options are the personalized settings written to pr-budget.json.
type Options struct {
	Budget             int      // <=0 uses DefaultBudget
	ExcludeMigrations  bool     // default-off in the struct; callers set it
	AdditionalExcludes []string // extra pathspecs excluded from the budget
	Force              bool     // overwrite an existing pr-budget.json
}

// Result reports what Init did.
type Result struct {
	StateDir         string
	CreatedOrcJSON   bool
	WrotePRBudget    bool
	GitignoreUpdated bool
}

type prBudget struct {
	Budget             int      `json:"budget"`
	ExcludeMigrations  bool     `json:"exclude_migrations"`
	AdditionalExcludes []string `json:"additional_excludes"`
}

// Init creates stateDir, seeds orc.json (without clobbering an existing one),
// writes the personalized pr-budget.json, and ensures rootForGitignore/.gitignore
// ignores .orc/.
func Init(stateDir, rootForGitignore string, opts Options) (Result, error) {
	res := Result{StateDir: stateDir}

	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		return res, fmt.Errorf("create %s: %w", stateDir, err)
	}

	// orc.json — seed an empty session registry only when absent.
	orcJSON := filepath.Join(stateDir, "orc.json")
	if _, err := os.Stat(orcJSON); os.IsNotExist(err) {
		if err := writeJSON(orcJSON, map[string]any{"sessions": []any{}}); err != nil {
			return res, err
		}
		res.CreatedOrcJSON = true
	} else if err != nil {
		return res, err
	}

	// pr-budget.json — the personalized per-repo config.
	budgetPath := filepath.Join(stateDir, "pr-budget.json")
	if _, err := os.Stat(budgetPath); err == nil && !opts.Force {
		// Keep the existing config unless forced.
	} else {
		budget := opts.Budget
		if budget <= 0 {
			budget = DefaultBudget
		}
		excludes := opts.AdditionalExcludes
		if excludes == nil {
			excludes = []string{}
		}
		if err := writeJSON(budgetPath, prBudget{
			Budget:             budget,
			ExcludeMigrations:  opts.ExcludeMigrations,
			AdditionalExcludes: excludes,
		}); err != nil {
			return res, err
		}
		res.WrotePRBudget = true
	}

	updated, err := ensureGitignore(filepath.Join(rootForGitignore, ".gitignore"))
	if err != nil {
		return res, err
	}
	res.GitignoreUpdated = updated

	return res, nil
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	if err := os.WriteFile(path, b, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

// ensureGitignore appends ".orc/" to the gitignore if not already ignored.
func ensureGitignore(path string) (bool, error) {
	b, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return false, err
	}
	for _, line := range strings.Split(string(b), "\n") {
		switch strings.TrimSpace(line) {
		case ".orc/", ".orc", "/.orc/", "/.orc":
			return false, nil
		}
	}

	content := string(b)
	prefix := ""
	if len(content) > 0 && !strings.HasSuffix(content, "\n") {
		prefix = "\n"
	}
	entry := prefix + "# orc workspace state — ephemeral, per-session. Never commit.\n.orc/\n"
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return false, err
	}
	defer f.Close()
	if _, err := f.WriteString(entry); err != nil {
		return false, err
	}
	return true, nil
}
