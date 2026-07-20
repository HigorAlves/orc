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
	if !slices.Contains(names, "github") {
		t.Errorf("Known() should include github: %v", names)
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
