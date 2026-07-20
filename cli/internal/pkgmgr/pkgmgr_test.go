package pkgmgr

import (
	"testing"

	"github.com/HigorAlves/orc/cli/internal/deps"
	"github.com/HigorAlves/orc/cli/internal/platform"
)

func tool(name string, install map[string][]string) deps.Tool {
	return deps.Tool{Name: name, Install: install}
}

func TestResolveSystemManager(t *testing.T) {
	jq := tool("jq", map[string][]string{"brew": {"jq"}, "apt": {"jq"}})

	cmd, ok := Resolve(jq, platform.Brew, false)
	if !ok || cmd.String() != "brew install jq" {
		t.Errorf("brew: got %q ok=%v", cmd.String(), ok)
	}

	cmd, ok = Resolve(jq, platform.Apt, false)
	if !ok || cmd.String() != "sudo apt-get install -y jq" {
		t.Errorf("apt: got %q ok=%v", cmd.String(), ok)
	}
}

func TestResolvePacmanUsesNoConfirm(t *testing.T) {
	gh := tool("gh", map[string][]string{"pacman": {"github-cli"}})
	cmd, ok := Resolve(gh, platform.Pacman, false)
	if !ok || cmd.String() != "sudo pacman -S --noconfirm github-cli" {
		t.Errorf("pacman: got %q ok=%v", cmd.String(), ok)
	}
}

func TestResolveFallsBackToNpm(t *testing.T) {
	ab := tool("agent-browser", map[string][]string{"npm": {"agent-browser"}})
	// No system recipe, but npm is available.
	cmd, ok := Resolve(ab, platform.Apt, true)
	if !ok || cmd.String() != "npm install -g agent-browser" {
		t.Errorf("npm fallback: got %q ok=%v", cmd.String(), ok)
	}
	// Without npm, there is no recipe.
	if _, ok := Resolve(ab, platform.Apt, false); ok {
		t.Error("expected no recipe without npm")
	}
}

func TestResolveCaskArgsPassThrough(t *testing.T) {
	docker := tool("docker", map[string][]string{"brew": {"--cask", "docker"}})
	cmd, ok := Resolve(docker, platform.Brew, false)
	if !ok || cmd.String() != "brew install --cask docker" {
		t.Errorf("cask: got %q ok=%v", cmd.String(), ok)
	}
}

func TestResolveNoRecipe(t *testing.T) {
	// docker on debian has no apt recipe in this fixture and no npm.
	docker := tool("docker", map[string][]string{"brew": {"--cask", "docker"}})
	if _, ok := Resolve(docker, platform.Apt, false); ok {
		t.Error("expected no recipe for docker on apt")
	}
	// No system manager and no npm.
	if _, ok := Resolve(docker, platform.NonePkgManager, false); ok {
		t.Error("expected no recipe with no managers available")
	}
}

func TestResolvePrefersSystemOverNpm(t *testing.T) {
	// A tool installable both ways should use the system manager first.
	both := tool("x", map[string][]string{"brew": {"x"}, "npm": {"x"}})
	cmd, ok := Resolve(both, platform.Brew, true)
	if !ok || cmd.Name != "brew" {
		t.Errorf("expected system manager preferred, got %q", cmd.String())
	}
}
