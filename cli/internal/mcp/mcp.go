// Package mcp models a small curated registry of MCP servers orc integrates
// with, so `orc mcp add <name>` expands to a full `claude mcp add` invocation.
// Unknown names are passed through to the claude CLI verbatim by the command
// layer, so this registry is a convenience, not a gate.
package mcp

import (
	"fmt"
	"strings"
)

const tokenPlaceholder = "{{TOKEN}}"

// Server is a known MCP server definition.
type Server struct {
	Name        string
	Description string
	// Args are appended to `claude mcp add`. A tokenPlaceholder in any arg is
	// replaced by the caller-supplied token.
	Args []string
	// NeedsToken requires a non-empty token at build time.
	NeedsToken bool
	// TokenEnv names an environment variable the command layer may read the
	// token from when no flag is given.
	TokenEnv string
}

// registry is the curated set. Keep entries conservative and documented.
var registry = []Server{
	{
		Name:        "github",
		Description: "GitHub's hosted MCP server (issues, PRs, code search). Requires a GitHub PAT.",
		Args: []string{
			"--transport", "http",
			"github", "https://api.githubcopilot.com/mcp/",
			"--header", "Authorization: Bearer " + tokenPlaceholder,
		},
		NeedsToken: true,
		TokenEnv:   "GITHUB_TOKEN",
	},
}

// Lookup returns a known server by name.
func Lookup(name string) (Server, bool) {
	for _, s := range registry {
		if s.Name == name {
			return s, true
		}
	}
	return Server{}, false
}

// Known returns the names of all registered servers.
func Known() []string {
	names := make([]string, 0, len(registry))
	for _, s := range registry {
		names = append(names, s.Name)
	}
	return names
}

// All returns the full registry (for listing with descriptions).
func All() []Server { return registry }

// BuildArgs resolves the token placeholder and returns the args for
// `claude mcp add`.
func (s Server) BuildArgs(token string) ([]string, error) {
	if s.NeedsToken && token == "" {
		return nil, fmt.Errorf("MCP server %q requires a token (pass --token or set %s)", s.Name, s.TokenEnv)
	}
	out := make([]string, len(s.Args))
	for i, a := range s.Args {
		out[i] = strings.ReplaceAll(a, tokenPlaceholder, token)
	}
	return out, nil
}
