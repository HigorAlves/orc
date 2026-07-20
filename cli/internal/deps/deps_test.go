package deps

import "testing"

func TestLoadEmbeddedRegistry(t *testing.T) {
	reg, err := Load()
	if err != nil {
		t.Fatalf("Load embedded tools.json: %v", err)
	}
	// The required tier must contain at least git and jq (orc's hard deps).
	names := map[string]Tier{}
	for _, tool := range reg.Tools {
		names[tool.Name] = tool.Tier
	}
	for _, req := range []string{"git", "jq"} {
		if names[req] != TierRequired {
			t.Errorf("%q should be tier=required, got %q", req, names[req])
		}
	}
	for _, rec := range []string{"gh", "agent-browser", "acli", "docker"} {
		if names[rec] != TierRecommended {
			t.Errorf("%q should be tier=recommended, got %q", rec, names[rec])
		}
	}
}

func TestEveryToolHasHints(t *testing.T) {
	reg, _ := Load()
	for _, tool := range reg.Tools {
		if len(tool.Hints) == 0 {
			t.Errorf("tool %q has no hints", tool.Name)
		}
		// Every tool must resolve a non-empty hint for an unknown platform.
		if tool.Hint("no-such-platform") == "" {
			t.Errorf("tool %q has no default hint", tool.Name)
		}
	}
}

func TestHintResolvesPlatformThenDefault(t *testing.T) {
	tool := Tool{
		Name:  "x",
		Hints: map[string]string{"macos": "brew install x", "default": "see docs"},
	}
	if got := tool.Hint("macos"); got != "brew install x" {
		t.Errorf("Hint(macos) = %q", got)
	}
	if got := tool.Hint("arch"); got != "see docs" {
		t.Errorf("Hint(arch) should fall back to default, got %q", got)
	}
}

func TestCheckPartitionsByTierAndPresence(t *testing.T) {
	reg, _ := Load()
	// Pretend only git is installed.
	present := map[string]bool{"git": true}
	rep := reg.Check(func(name string) bool { return present[name] })

	var gitStatus *Status
	for i := range rep.Required {
		if rep.Required[i].Tool.Name == "git" {
			gitStatus = &rep.Required[i]
		}
	}
	if gitStatus == nil || !gitStatus.Present {
		t.Fatal("git should be reported present in the required tier")
	}
	if len(rep.MissingRequired()) == 0 {
		t.Error("jq should be reported as missing required")
	}
	for _, s := range rep.MissingRequired() {
		if s.Present {
			t.Error("MissingRequired returned a present tool")
		}
	}
	if len(rep.MissingRecommended()) == 0 {
		t.Error("recommended tools should be missing when none installed")
	}
}

func TestInstallArgs(t *testing.T) {
	tool := Tool{
		Name:    "git",
		Install: map[string][]string{"brew": {"git"}, "apt": {"git"}},
	}
	if args, ok := tool.InstallArgs("brew"); !ok || len(args) != 1 || args[0] != "git" {
		t.Errorf("InstallArgs(brew) = %v, %v", args, ok)
	}
	if _, ok := tool.InstallArgs("dnf"); ok {
		t.Error("InstallArgs(dnf) should report no recipe when absent")
	}
}

func TestGitInstallableViaCommonManagers(t *testing.T) {
	reg, _ := Load()
	var git Tool
	for _, tool := range reg.Tools {
		if tool.Name == "git" {
			git = tool
		}
	}
	for _, mgr := range []string{"brew", "apt", "dnf", "pacman"} {
		if _, ok := git.InstallArgs(mgr); !ok {
			t.Errorf("git should have an install recipe for %q", mgr)
		}
	}
}
