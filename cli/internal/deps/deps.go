// Package deps models the external CLI tools orc relies on and checks which are
// installed. The tool registry is embedded from tools.json, a CI-verified mirror
// of the canonical orc/lib/tools.json (the SessionStart hook reads the same
// file), so the CLI and the plugin never drift on the tool set or install hints.
package deps

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed tools.json
var toolsJSON []byte

// Tier classifies how essential a tool is.
type Tier string

const (
	TierRequired    Tier = "required"
	TierRecommended Tier = "recommended"
)

// Tool describes one external dependency.
type Tool struct {
	Name string `json:"name"`
	Tier Tier   `json:"tier"`
	// UsedBy is a short, human-readable note (markdown) about which commands
	// need this tool. Set only for recommended tools.
	UsedBy string `json:"usedBy,omitempty"`
	// Hints maps a platform id (macos/debian/fedora/arch/linux) to a human
	// install hint, with a required "default" fallback.
	Hints map[string]string `json:"hints"`
	// Install maps a package-manager id (brew/apt/dnf/pacman/npm) to the args
	// passed after that manager's install verb. Absent when there is no safe
	// unattended recipe.
	Install map[string][]string `json:"install,omitempty"`
}

// Hint returns the install hint for platform, falling back to the default.
func (t Tool) Hint(platform string) string {
	if h, ok := t.Hints[platform]; ok {
		return h
	}
	return t.Hints["default"]
}

// InstallArgs returns the install args for a package manager, and whether a
// recipe exists.
func (t Tool) InstallArgs(manager string) ([]string, bool) {
	args, ok := t.Install[manager]
	return args, ok
}

// Registry is the full set of tools orc knows about.
type Registry struct {
	Tools []Tool `json:"tools"`
}

// Load parses the embedded registry.
func Load() (Registry, error) {
	var reg Registry
	if err := json.Unmarshal(toolsJSON, &reg); err != nil {
		return Registry{}, fmt.Errorf("parse embedded tools.json: %w", err)
	}
	return reg, nil
}

// Status pairs a tool with whether it was found on the host.
type Status struct {
	Tool    Tool
	Present bool
}

// Report is the outcome of a Check, partitioned by tier.
type Report struct {
	Required    []Status
	Recommended []Status
}

// Check evaluates every tool against has (typically platform.Detector.Has).
func (r Registry) Check(has func(name string) bool) Report {
	var rep Report
	for _, tool := range r.Tools {
		s := Status{Tool: tool, Present: has(tool.Name)}
		switch tool.Tier {
		case TierRequired:
			rep.Required = append(rep.Required, s)
		default:
			rep.Recommended = append(rep.Recommended, s)
		}
	}
	return rep
}

// MissingRequired returns the required tools that are absent.
func (rep Report) MissingRequired() []Status { return missing(rep.Required) }

// MissingRecommended returns the recommended tools that are absent.
func (rep Report) MissingRecommended() []Status { return missing(rep.Recommended) }

// OK reports whether all required tools are present.
func (rep Report) OK() bool { return len(rep.MissingRequired()) == 0 }

func missing(in []Status) []Status {
	var out []Status
	for _, s := range in {
		if !s.Present {
			out = append(out, s)
		}
	}
	return out
}
