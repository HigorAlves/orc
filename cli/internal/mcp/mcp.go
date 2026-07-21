// Package mcp models a curated registry of MCP servers orc integrates with, so
// the TUI and `orc mcp add <name>` can toggle them on/off by name. Unknown names
// are passed through to the claude CLI verbatim by the command layer, so this
// registry is a convenience, not a gate.
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
	// Args are appended to `claude mcp add` (the server name is included). A
	// tokenPlaceholder in any arg is replaced by the caller-supplied token.
	Args []string
	// NeedsToken requires a non-empty token at build time (static-token servers
	// like GitHub). OAuth servers leave this false — auth happens in-browser on
	// first use.
	NeedsToken bool
	// TokenEnv names an environment variable the command layer may read the
	// token from when no flag is given.
	TokenEnv string
}

// registry is the curated set. OAuth servers need no static token; GitHub uses
// a PAT.
var registry = []Server{
	{
		Name:        "github",
		Description: "GitHub — issues, PRs, code search (needs a GitHub PAT)",
		Args: []string{
			"--transport", "http",
			"github", "https://api.githubcopilot.com/mcp/",
			"--header", "Authorization: Bearer " + tokenPlaceholder,
		},
		NeedsToken: true,
		TokenEnv:   "GITHUB_TOKEN",
	},
	{
		Name:        "jira",
		Description: "Atlassian Jira & Confluence (OAuth in browser)",
		Args:        []string{"--transport", "sse", "jira", "https://mcp.atlassian.com/v1/sse"},
	},
	{
		Name:        "sentry",
		Description: "Sentry — issues, traces, releases (OAuth in browser)",
		Args:        []string{"--transport", "http", "sentry", "https://mcp.sentry.dev/mcp"},
	},
	{
		Name:        "vercel",
		Description: "Vercel — projects, deployments, logs (OAuth in browser)",
		Args:        []string{"--transport", "http", "vercel", "https://mcp.vercel.com"},
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

// ParseConfigured extracts the configured server names from `claude mcp list`
// output. Lines look like "name: url - status"; the name is the text before the
// first ": ".
func ParseConfigured(listOutput string) []string {
	var names []string
	for _, line := range strings.Split(listOutput, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		idx := strings.Index(line, ": ")
		if idx <= 0 {
			continue
		}
		names = append(names, strings.TrimSpace(line[:idx]))
	}
	return names
}
