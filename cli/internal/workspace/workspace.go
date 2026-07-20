// Package workspace detects the orc execution context (repo / workspace / loose)
// and the canonical .orc state directory, mirroring orc/lib/workspace-detect.sh
// so the CLI and the plugin agree on where state lives.
package workspace

import (
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

// Kind is the detected context.
type Kind string

const (
	Repo      Kind = "repo"
	Workspace Kind = "workspace"
	Loose     Kind = "loose"
)

// Context is the resolved execution context.
type Context struct {
	Kind          Kind
	RepoRoot      string
	WorkspaceRoot string
	WorkspaceName string
	Repos         []string
	StateDir      string // canonical .orc dir, empty for loose
}

// Detector resolves a context. Its dependencies are injectable for tests.
type Detector struct {
	// GitToplevel returns the git work-tree root containing dir, and whether dir
	// is inside a repo.
	GitToplevel func(dir string) (string, bool)
	// ChildRepos returns the sorted names of immediate child directories of dir
	// that are git repos.
	ChildRepos func(dir string) []string
}

// NewDetector wires a Detector to the real git and filesystem.
func NewDetector() Detector {
	return Detector{GitToplevel: gitToplevel, ChildRepos: childRepos}
}

// Detect classifies the given working directory using the real environment.
func Detect(cwd string) Context {
	return NewDetector().Classify(cwd)
}

// Classify applies the detection precedence: inside a repo → repo; else ≥2 child
// repos → workspace; else loose.
func (d Detector) Classify(cwd string) Context {
	if top, ok := d.GitToplevel(cwd); ok {
		return Context{Kind: Repo, RepoRoot: top, StateDir: filepath.Join(top, ".orc")}
	}
	repos := d.ChildRepos(cwd)
	if len(repos) >= 2 {
		return Context{
			Kind:          Workspace,
			WorkspaceRoot: cwd,
			WorkspaceName: filepath.Base(cwd),
			Repos:         repos,
			StateDir:      filepath.Join(cwd, ".orc"),
		}
	}
	return Context{Kind: Loose}
}

func gitToplevel(dir string) (string, bool) {
	out, err := exec.Command("git", "-C", dir, "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", false
	}
	top := strings.TrimSpace(string(out))
	return top, top != ""
}

func childRepos(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var repos []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		child := filepath.Join(dir, e.Name())
		if err := exec.Command("git", "-C", child, "rev-parse", "--is-inside-work-tree").Run(); err == nil {
			repos = append(repos, e.Name())
		}
	}
	sort.Strings(repos)
	return repos
}
