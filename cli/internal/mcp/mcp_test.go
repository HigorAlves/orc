package mcp

import (
	"slices"
	"testing"
)

func TestLookupKnownServer(t *testing.T) {
	s, ok := Lookup("github")
	if !ok {
		t.Fatal("github should be a known MCP server")
	}
	if s.Name != "github" || s.Description == "" {
		t.Errorf("unexpected server: %+v", s)
	}
}

func TestLookupUnknown(t *testing.T) {
	if _, ok := Lookup("does-not-exist"); ok {
		t.Error("unknown server should not be found")
	}
}

func TestBuildArgsSubstitutesToken(t *testing.T) {
	s, _ := Lookup("github")
	args, err := s.BuildArgs("secret-token")
	if err != nil {
		t.Fatal(err)
	}
	joined := slices.Contains(args, "Authorization: Bearer secret-token") ||
		containsSubstr(args, "secret-token")
	if !joined {
		t.Errorf("token not substituted into args: %v", args)
	}
	for _, a := range args {
		if a == tokenPlaceholder || containsSubstr([]string{a}, tokenPlaceholder) {
			t.Errorf("placeholder left unresolved: %q", a)
		}
	}
}

func TestBuildArgsRequiresToken(t *testing.T) {
	s, _ := Lookup("github")
	if !s.NeedsToken {
		t.Skip("github no longer needs a token; update this test")
	}
	if _, err := s.BuildArgs(""); err == nil {
		t.Error("BuildArgs should error when a required token is missing")
	}
}

func TestKnownListsRegistry(t *testing.T) {
	names := Known()
	for _, want := range []string{"github", "jira", "sentry", "vercel"} {
		if !slices.Contains(names, want) {
			t.Errorf("Known() should include %q: %v", want, names)
		}
	}
}

func TestOAuthServersNeedNoToken(t *testing.T) {
	for _, name := range []string{"jira", "sentry", "vercel"} {
		s, ok := Lookup(name)
		if !ok {
			t.Fatalf("%s missing from registry", name)
		}
		if s.NeedsToken {
			t.Errorf("%s should be OAuth (no static token)", name)
		}
		if _, err := s.BuildArgs(""); err != nil {
			t.Errorf("%s BuildArgs with no token errored: %v", name, err)
		}
	}
}

func TestParseConfigured(t *testing.T) {
	out := `Checking MCP server health…

github: https://api.githubcopilot.com/mcp/ - ✓ connected
claude.ai Gmail: https://gmailmcp.googleapis.com/mcp/v1 - ! Needs authentication
`
	got := ParseConfigured(out)
	if !slices.Contains(got, "github") {
		t.Errorf("expected github in %v", got)
	}
	if !slices.Contains(got, "claude.ai Gmail") {
		t.Errorf("expected multi-word name in %v", got)
	}
	if slices.Contains(got, "") {
		t.Errorf("blank lines should be skipped: %v", got)
	}
}

func containsSubstr(list []string, sub string) bool {
	for _, s := range list {
		for i := 0; i+len(sub) <= len(s); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
	}
	return false
}
