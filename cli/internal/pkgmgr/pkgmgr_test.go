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

	cmd, ok := Resolve(jq, platform.Brew, false, false, false)
	if !ok || cmd.String() != "brew install jq" {
		t.Errorf("brew: got %q ok=%v", cmd.String(), ok)
	}

	cmd, ok = Resolve(jq, platform.Apt, false, false, false)
	if !ok || cmd.String() != "sudo apt-get install -y jq" {
		t.Errorf("apt: got %q ok=%v", cmd.String(), ok)
	}
}

func TestResolvePacmanUsesNoConfirm(t *testing.T) {
	gh := tool("gh", map[string][]string{"pacman": {"github-cli"}})
	cmd, ok := Resolve(gh, platform.Pacman, false, false, false)
	if !ok || cmd.String() != "sudo pacman -S --noconfirm github-cli" {
		t.Errorf("pacman: got %q ok=%v", cmd.String(), ok)
	}
}

func TestResolveFallsBackToNpm(t *testing.T) {
	ab := tool("agent-browser", map[string][]string{"npm": {"agent-browser"}})
	// No system recipe, but npm is available.
	cmd, ok := Resolve(ab, platform.Apt, true, false, false)
	if !ok || cmd.String() != "npm install -g agent-browser" {
		t.Errorf("npm fallback: got %q ok=%v", cmd.String(), ok)
	}
	// Without npm, there is no recipe.
	if _, ok := Resolve(ab, platform.Apt, false, false, false); ok {
		t.Error("expected no recipe without npm")
	}
}

func TestResolveCaskArgsPassThrough(t *testing.T) {
	docker := tool("docker", map[string][]string{"brew": {"--cask", "docker"}})
	cmd, ok := Resolve(docker, platform.Brew, false, false, false)
	if !ok || cmd.String() != "brew install --cask docker" {
		t.Errorf("cask: got %q ok=%v", cmd.String(), ok)
	}
}

func TestResolveNoRecipe(t *testing.T) {
	// docker on debian has no apt recipe in this fixture and no npm.
	docker := tool("docker", map[string][]string{"brew": {"--cask", "docker"}})
	if _, ok := Resolve(docker, platform.Apt, false, false, false); ok {
		t.Error("expected no recipe for docker on apt")
	}
	// No system manager and no npm/uv/pipx.
	if _, ok := Resolve(docker, platform.NonePkgManager, false, false, false); ok {
		t.Error("expected no recipe with no managers available")
	}
}

func TestResolvePrefersSystemOverNpm(t *testing.T) {
	// A tool installable both ways should use the system manager first.
	both := tool("x", map[string][]string{"brew": {"x"}, "npm": {"x"}})
	cmd, ok := Resolve(both, platform.Brew, true, false, false)
	if !ok || cmd.Name != "brew" {
		t.Errorf("expected system manager preferred, got %q", cmd.String())
	}
}

func TestResolveUvAndPipx(t *testing.T) {
	// A Python-distributed tool (like graphify) with uv + pipx recipes and no
	// system/npm recipe.
	g := tool("graphify", map[string][]string{"uv": {"graphifyy"}, "pipx": {"graphifyy"}})

	// uv is preferred over pipx when both are available.
	cmd, ok := Resolve(g, platform.NonePkgManager, false, true, true)
	if !ok || cmd.String() != "uv tool install graphifyy" {
		t.Errorf("uv: got %q ok=%v", cmd.String(), ok)
	}

	// pipx is used when uv is absent.
	cmd, ok = Resolve(g, platform.NonePkgManager, false, false, true)
	if !ok || cmd.String() != "pipx install graphifyy" {
		t.Errorf("pipx: got %q ok=%v", cmd.String(), ok)
	}

	// Neither available → no unattended recipe (caller prints the hint).
	if _, ok := Resolve(g, platform.NonePkgManager, false, false, false); ok {
		t.Error("expected no recipe without uv or pipx")
	}
}

func TestResolvePrefersNpmOverUv(t *testing.T) {
	// Resolve order is sysMgr → npm → uv → pipx. A tool with both npm and uv
	// recipes, no system manager, should pick npm.
	both := tool("y", map[string][]string{"npm": {"y"}, "uv": {"y"}})
	cmd, ok := Resolve(both, platform.NonePkgManager, true, true, true)
	if !ok || cmd.Name != "npm" {
		t.Errorf("expected npm preferred over uv, got %q", cmd.String())
	}
}

func TestPostInstall(t *testing.T) {
	// A tool with a finish-setup step returns its command.
	g := deps.Tool{Name: "graphify", PostInstall: []string{"graphify", "install"}}
	post, ok := PostInstall(g)
	if !ok || post.String() != "graphify install" {
		t.Errorf("PostInstall: got %q ok=%v", post.String(), ok)
	}
	// A single-step tool has no post-install command.
	if _, ok := PostInstall(deps.Tool{Name: "jq"}); ok {
		t.Error("expected no post-install for a single-step tool")
	}
}
